import abab from 'abab'
import lodash from 'lodash'

declare var global: any

global.library = {
    load: function (name: string): any {
        if (name === 'abab') {
            return abab
        } else if (name === 'lodash') {
            return lodash
        } else {
            throw new Error(`Unsupported library to load: '${name}'`)
        }
    }
}