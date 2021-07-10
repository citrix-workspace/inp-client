#!/usr/bin/env node

import 'isomorphic-fetch'
import * as fs from 'fs'
import {OptionValues, program} from 'commander'
import {createEndpoints, createIntegration, createRegistration, uploadJavascript} from "./inp-endpoints";
import {BUNDLE_DIR} from "./config";
import {Buffer} from 'buffer'
import path from "path";

program
    .option('-p, --param [parameters...]', 'parameters')
    .option('-c, --create-integration', 'Create integration from payloads')
    .option('-r, --registration <filename>', 'Create integration from payloads')
program.parse()

main(program.opts())
    .then(() => console.log('Done.'))
    .catch(error => console.error(`Failed with error: ${error}`))

async function main(args: OptionValues) {
    console.log(`main(${JSON.stringify(args)})`)
    return createIntegration(loadResource('integration.json'))
        .then(async integration => {
            // FIXME hardcoded script name
            // FIXME process all scripts from endpoints.json
            const scriptName = 'hello-world'
            const script = loadResource(path.join('scripts', `${scriptName}.js`))
            const scriptResource = await uploadJavascript(integration.id, scriptName, script)
            return ({integration, scripts: scriptResource})
        })
        .then(async integration => {
            const endpoints = JSON.parse(loadResource('endpoints.json'))
            const endpointsResource = await Promise.all(endpoints.map((endpoint: any) => {
                const {name, httpMethod, endpointType, category, endpointScripts} = endpoint
                const endpointScriptRequest = {
                    name,
                    httpMethod,
                    endpointType,
                    category,
                    endpointScriptRequests: endpointScripts.map(({functionName, endpointScriptType}: any) => ({
                        // FIXME hardcoded scriptId, map scriptId to script name from endpoints.json
                        scriptId: integration.scripts.id,
                        functionName,
                        endpointScriptType,
                    })),
                }
                return createEndpoints(integration.integration.id, JSON.stringify(endpointScriptRequest))
            }))
            return ({...integration, endpoints: endpointsResource})
        })
        .then(async integration => {
            const registrationPayload = loadResource('registration.json')
            const registrationResource = await createRegistration(integration.integration.id, registrationPayload)
            return ({...integration, registration: registrationResource})
        })
        .then(integration => {
            saveResource('created-integration.json', formatJson(integration))
            return integration
        })
        .then((integration) => console.log(`Integration created: ${formatJson(integration)}`))
        .catch(error => console.error(`Create Integration failed: ${error}`))
}

function formatJson(object: any): string {
    return JSON.stringify(object, null, 2)
}

function loadResource(name: string): string {
    const fileName = path.join(path.resolve('.'), BUNDLE_DIR, name)
    console.log(`Loading resource from ${fileName}`)
    return Buffer.from(fs.readFileSync(fileName)).toString()
}

function saveResource(name: string, content: string): void {
    const fileName = path.join(path.resolve('.'), BUNDLE_DIR, name)
    console.log(`Saving resource to ${fileName}`)
    fs.writeFileSync(fileName, content)
}