import {Dictionary} from "../types";
import path from "path";
import fs from "fs";

export function parseKeyValue(params: string[] = []): Dictionary {
    return params.reduce((acc, item) => {
        // FIXME handle multiple = in the parameter
        const [key, value] = item.split('=')
        if (key != null && value != null) {
            return {...acc, [key]: value}
        } else {
            return acc
        }
    }, {})
}

export function toParameters(acc: Dictionary, [key, value]: string[]): Dictionary {
    acc[key] = value
    return acc
}

export function loadFiles(params: Dictionary): Dictionary {
    return Object.entries(params).map(([key, value]) => {
        if (typeof value === 'string' && value.startsWith('@@')) {
            return [key, value.substr(1)]
        } else if (typeof value === 'string' && value.startsWith('@')) {
            const fileName = path.join(process.cwd(), value.substr(1))
            const file = fs.readFileSync(fileName)
            return [key, file.toString()]
        } else {
            return [key, value]
        }
    }).reduce(toParameters, {} as Dictionary)
}