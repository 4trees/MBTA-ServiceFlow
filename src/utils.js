import {csv} from 'd3';

export const fetchCsv = (url, parse) => {
	return new Promise((resolve, reject) => {
		csv(url, parse, (err, data) => {
			if(err){
				reject(err);
			}else{
				resolve(data);
			}
		})
	});
}


export const toSecond = (str) => {
    const strs = str.split(':')
    return (+strs[0] * 3600) + (+strs[1] * 60)
}

export const value_limit = (val, min, max) => {
    return val < min ? min : (val > max ? max : val);
}

