import './style/style.css';
import * as d3 from 'd3';


//Import utility function
import { parseStopTimes, parseStop } from './parse';
import { fetchCsv, toSecond, value_limit } from './utils';


const gtfs = "/MBTA_GTFS/"
const [stops, stop_times] = [
    "nodeStopsGTFS.csv",
    "keyStopsGTFS.csv"
]




const animation = Animation(document.querySelector('#maps'))
let routeFilter = undefined,
    paused = false

const button = d3.select('.button')


Promise.all([
    fetchCsv(gtfs + stops, parseStop),
    fetchCsv(gtfs + stop_times, parseStopTimes)
]).then(([stops, stopTimesD]) => {
    // console.log(stops, stopTimesD)

    animation(stops, stopTimesD)

})
animation.on('selection:station', (station, route_lookup, stop_lookup) => {
        // console.log(station)
        d3.selectAll('.station').transition().style('opacity', .3)
        d3.select(`#${station.key}`).transition().duration(800).style('opacity', 1)


        const routes = route_lookup.get(station.key)
        if (routes) routeFilter = routes.route_list

        let routeList = routeFilter ? routes.routes.map(d => {
            return `<span style="color:#${d.values[0].route_color}">${d.key}</span>`
        }).join('') : ''

        const stopName = stop_lookup.get(station.key).stop_name.split('-')[0]

        const tooltip = d3.select('.custom-tooltip')
            .html(`
                <p>${stopName}</p>
                <p class="route">${routeList}</p>
            `)
        const svgNode = d3.select('svg').node()
        let [x, y] = d3.mouse(svgNode)
        const [tooltip_w, tooltip_h] = [tooltip.node().clientWidth, tooltip.node().clientHeight]
        const [w, h] = [svgNode.clientWidth, svgNode.clientHeight]
        x = (x + 10 + tooltip_w) > w ? (x - tooltip_w - 10) : (x + 10)
        y = (y + 10 + tooltip_h) > h ? (y - tooltip_h - 10) : (y + 10)
        tooltip.style('left', x + 'px')
            .style('top', y + 'px')
            .transition().duration(500)
            .style('opacity', 1);

    })
    .on('unselection:station', () => {
        d3.select('.custom-tooltip').transition().style('opacity', 0)

        d3.selectAll('.station').transition().style('opacity', 1)

        routeFilter = undefined
    })

function Animation(_) {
    // console.log(_)

    let projection = d3.geoMercator()
    let loop, minT, maxT
    let time = d3.select('.time')


    let zoom = d3.zoom()
        .on("zoom", zoomed);
    let drag = d3.drag()
        .on("end", dragged);

    const _dispatch = d3.dispatch('selection:station', 'unselection:station')

    let _t, _w, _h, ctx, stops, trips, _clock, _trips;
    let scale_r = 1;

    function animation(stopsD, stopTimesD) {
        button.on('click', function() {

            d3.select(this).classed('paused', !d3.select(this).classed('paused'))

            paused = !d3.select(this).classed('paused')
            console.log(paused)
            if (paused) {
                cancelAnimationFrame(loop)
                _t = _t - 30
                console.log(_t)

            } else {
                renderFrame()
            }
        })

        //get parent stations (only display parent stations)
        const parentStaionList = stopsD.map(d => d.parent_station).filter(d => d != '')
            .filter((d, i, v) => (v.indexOf(d) === i) && d != undefined)


        let stopTimesBystoproute = d3.nest()
            .key(d => d.stop_new)
            .key(d => d.route_id)
            .entries(stopTimesD)
        stopTimesBystoproute = stopTimesBystoproute.map(d => {
            return {
                stop: d.key,
                route_list: d.values.map(route => route.key),
                routes: d.values
            }
        })
        const stoproute_lookup = d3.map(stopTimesBystoproute, d => d.stop)
        const stop_lookup = d3.map(stopsD, d => d.stop_new)

        let stopTimesBystoprouteColor = d3.nest()
            .key(d => d.stop_new)
            .key(d => d.route_color)
            .entries(stopTimesD)



        stops = stopTimesBystoprouteColor.filter(d => parentStaionList.includes(d.key))
            .map(d => {
                return {
                    key: d.key,
                    color: d.values.map(route => `${route.key}`),
                    stop_name: d.values.map(trip => trip.values[0].stop_name),
                    stop_lon: d.values[0].values[0].stop_lon,
                    stop_lat: d.values[0].values[0].stop_lat,
                }
            })


        let stopTimesBytrip = d3.nest()
            .key(d => d.trip_id)
            .key(d => d.arrival_time).sortKeys(d3.ascending)
            .entries(stopTimesD)

        trips = stopTimesBytrip.map(d => {
            const current = d.values[0]
            const next = d.values[1]

            d.current = current ? { key: current.key, values: current.values, index: 0 } : undefined;
            d.next = next ? { key: next.key, values: next.values, index: 1 } : undefined;
            return d
        })
        // _trips = Array.from(trips)
        minT = d3.min(stopTimesD, d => d.arrival_time)
        maxT = d3.max(stopTimesD, d => d.arrival_time)

        //GET DOM, set initials
        const root = d3.select(_)
        _w = _.clientWidth
        _h = _.clientHeight
        // _t = minT
        // time.html('00:00:00')


        projection.translate([_w / 2, _h / 2])
            .scale(150000)
            .center([-71.081543, 42.348560])
        // root.call(zoom)

        //prepare svg and canvas
        let svg = root.selectAll('.animation-layer-svg')
            .data([1])
        svg = svg.enter().append('svg')
            .attr('class', 'animation-layer-svg')
            .merge(svg)
            .attr('width', _w)
            .attr('height', _h)
            .style('position', 'absolute')
            .style('top', 0)
            .style('left', 0)
            .call(drag)
            .call(zoom)
            .append('g')

        let canvas = root.selectAll('canvas')
            .data([1])
        canvas = canvas.enter().append('canvas')
            .attr('class', 'animation-layer-canvas')
            .merge(canvas)
            .attr('width', _w)
            .attr('height', _h)
            .style('position', 'absolute')
            .style('top', 0)
            .style('left', 0)

        ctx = canvas.node().getContext('2d');


        //draw stations
        const stationNodes = svg
            .selectAll('.station')
            .data(stops, d => d.key)
        const stationEnter = stationNodes.enter()
            .append('g')
            .attr('id', d => d.key)
            .attr('class', 'station')
            .on('mouseover', d => {

                _dispatch.call('selection:station', null, d, stoproute_lookup, stop_lookup)
            })
            .on('mouseleave', function() {
                _dispatch.call('unselection:station', null)
            })
        stationEnter.append('circle').attr('class', 'shadow')
            .attr('r', d => (d.color.length * 1.5 + 3) * scale_r)
            .style('opacity', 0)

        stationEnter.selectAll('.node').data(d => d.color)
            .enter()
            .append('circle').attr('class', 'node')
            .attr('r', 0)
            .style('stroke', d => `#${d}`)
            .style('fill', 'none')
            .style('stroke-width', 1.5)
            .transition().duration(1000)
            .attr('r', (d, i) => (2 + i * 1.5) * scale_r)

        stationEnter.merge(stationNodes)
            .attr('transform', d => {
                const [x, y] = projection([d.stop_lon, d.stop_lat])
                return `translate(${x},${y})`
            })


        d3.select('.intro').classed('collapse', true)
        initial()
        renderFrame()

    }

    function zoomed() {
        console.log('zoomed')
        cancelAnimationFrame(loop)


        const currScale = projection.scale();
        //The deltaY property returns a positive value when scrolling down, and a negative value when scrolling up, 
        const newScale = value_limit(currScale - 2000 * event.deltaY, 150000, 300000);
        const currTranslate = projection.translate();
        const coords = projection.invert([event.offsetX, event.offsetY]);
        projection.scale(newScale);
        const newPos = projection(coords);
        projection.translate([currTranslate[0] + (event.offsetX - newPos[0]), currTranslate[1] + (event.offsetY - newPos[1])]);

        scale_r = newScale / 150000

        const stations = d3.selectAll('.station')
        stations.transition().duration(100)
            .attr('transform', d => {
                const [x, y] = projection([d.stop_lon, d.stop_lat])
                return `translate(${x},${y})`
            })
        stations.selectAll('.shadow').attr('r', d => (d.color.length * 1.5 + 3) * scale_r)
        stations.selectAll('.node').attr('r', (d, i) => (2 + i * 1.5) * scale_r)

        renderFrame()

    }

    function dragged(_) {
        console.log('dragged')
        cancelAnimationFrame(loop)

        const currTranslate = projection.translate();

        projection.translate([event.clientX, event.clientY]);

        d3.selectAll('.station')
            .transition().duration(100)
            .attr('transform', d => {
                const [x, y] = projection([d.stop_lon, d.stop_lat])
                return `translate(${x},${y})`
            })

        renderFrame()

    }

    function initial() {

        _trips = trips.map(a => ({ ...a }));
        _t = minT
        time.html('00:00:00')
    }


    function renderFrame() {
        //clear the frame
        ctx.clearRect(0, 0, _w, _h)


        time.html(_clock)

        _trips.forEach((trip, i) => {
            // console.log(trips)


            const current = trip.current
            if (current) {
                const t = +current.key
                const next = trip.next

                if (t <= _t) {

                    _clock = current.values[0].arrival_clock
                    //draw current
                    current.values.forEach(d => {
                        const bikePath2D = new Path2D()
                        const radius = d.route_type != 3 ? 3 : 1.5
                        //const pct = (_t - t0) / (t - t0)

                        //opacity = pct == 1 ? opacity : .5
                        let opacity = routeFilter ? (routeFilter.includes(d.route_id) ? 1 : .02) : 1  
                        //x * pct, y * pct                      
                        const [x, y] = projection([d.stop_lon, d.stop_lat]);
                        
                        
                        bikePath2D.moveTo(x, y)
                        bikePath2D.arc(x, y, radius * scale_r, 0, Math.PI * 2)

                        ctx.globalAlpha = opacity;
                        ctx.fillStyle = `#${d.route_color}`;
                        ctx.fill(bikePath2D)

                    })

                    if (t < _t) {
                        //update current
                        trip.current = trip.next
                        if (next) {
                            //update next                
                            const nextIndex_new = trip.next.index + 1
                            const next_new = trip.values[nextIndex_new]
                            trip.next = next_new ? { key: next_new.key, values: next_new.values, index: nextIndex_new } : undefined
                        }

                    }
                }
            }




        })

        if (_t > maxT) {
            console.log('>=', minT)
            d3.select('.button').classed('paused', false)
            cancelAnimationFrame(loop);
            initial()
        } else {
            if (!paused) {
                _t = _t + 30
                loop = requestAnimationFrame(renderFrame)
            }
        }

    }
    animation.on = function(eventType, callback) {
        _dispatch.on(eventType, callback)
        return this
    }
    return animation
}