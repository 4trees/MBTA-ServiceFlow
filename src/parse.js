import {toSecond } from './utils';

export const parseStopTimes = (d) => {
    return {
        stop_id: d.stop_id.replace('-',''),
        stop_lon: d.stop_lon,
        stop_lat: d.stop_lat,
        stop_name: d.stop_name,
        stop_sequence:d.stop_sequence,
        parent_station:d.parent_station != '' ? d.parent_station.replace('-','') : undefined,
        stop_new: d.parent_station == '' ?  d.stop_id : d.parent_station.replace('-',''),
        arrival_time: toSecond(d.arrival_time),
        arrival_clock: d.arrival_time,
        trip_id: d.trip_id,
        route_id: d.route_id,
        route_color: d.route_color,
        route_desc: d.route_desc,
        route_type: +d.route_type

    }
}

export const parseStop = (d) => {
    return {
        stop_id: d.stop_id.replace('-',''),
        stop_lon: d.stop_lon,
        stop_lat: d.stop_lat,
        stop_name: d.stop_name,
        parent_station: d.parent_station != '' ? d.parent_station.replace('-','') : undefined,
        stop_new: d.parent_station == '' ?  d.stop_id : d.parent_station.replace('-',''),
        route_id:d.route_id,
        route_color: d.route_color
    }
}

