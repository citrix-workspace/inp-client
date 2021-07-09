#!/usr/bin/env node

import 'isomorphic-fetch'
import fs from 'fs'
import chalk from 'chalk'
import {program, OptionValues} from 'commander'
import {getSuccessJson} from 'src/lib/validation'
import {loadFiles, parseKeyValue} from "src/lib/parameterUtil";
import path from "path";


program
    .option('-p, --param [parameters...]', 'parameters')
    .option('-f, --functionName <name>', 'script function name')
program.parse()

main(program.opts())
    .then(() => console.log('Done.'))
    .catch(error => console.error(`Failed with error: ${error}`))

async function main(args: OptionValues) {
    console.log(`main(${JSON.stringify(args)})`)
}