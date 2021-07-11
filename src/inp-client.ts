#!/usr/bin/env node

import 'isomorphic-fetch'
import * as fs from 'fs'
import {OptionValues, program} from 'commander'
import {createEndpoints, createIntegration, createRegistration, uploadJavascript} from "./inp-endpoints";
import {BUNDLE_DIR} from "./config";
import {Buffer} from 'buffer'
import path from "path";
import {EndpointScript, EndpointsDefinition, EndpointsDefinitions} from "./types";

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
            const endpointDefinitions: EndpointsDefinitions = JSON.parse(loadResource('endpoints.json'))
            const scriptResources = await Promise.all(endpointDefinitions.map(endpoint => createScriptsForEndpoint(integration.id, endpoint)).flat())
            return ({integration, scripts: scriptResources,  endpointDefinitions})
        })
        .then(async result => {
            const endpoints = await Promise.all(result.endpointDefinitions.map((endpoint) => {
                const {name, httpMethod, endpointType, category, endpointScripts} = endpoint
                const endpointScriptRequest = {
                    name,
                    httpMethod,
                    endpointType,
                    category,
                    endpointScriptRequests: endpointScripts.map(({functionName, endpointScriptType, scriptName}) => ({
                        scriptId: findScriptId(result.scripts,  scriptName),
                        functionName,
                        endpointScriptType,
                    })),
                }
                return createEndpoints(result.integration.id, JSON.stringify(endpointScriptRequest))
            }))
            return ({...result, endpoints})
        })
        .then(async integration => {
            const registrationPayload = loadResource('registration.json')
            const registrationResource = await createRegistration(integration.integration.id, registrationPayload)
            return ({...integration, registration: registrationResource})
        })
        .then(result => {
            saveResource('created-integration.json', formatJson(result))
            console.log(`Integration id=${result.integration.id} created`)
            return result
        })
        .catch(error => console.error(`Create Integration failed: ${error} ${error.stack}`))
}

function createScriptsForEndpoint(integrationId: string, endpoint: EndpointsDefinition): Promise<any>[] {
    return endpoint.endpointScripts.map(endpointScript => createEndpointScript(integrationId, endpointScript))
}

function createEndpointScript(integrationId: string, {scriptName}: EndpointScript): Promise<any> {
    const scriptFileName = scriptName.toLocaleLowerCase().endsWith('.js') ? scriptName : `${scriptName}.js`
    const script = loadResource(path.join('scripts', scriptFileName))
    return uploadJavascript(integrationId, scriptName, script)
}

function findScriptId(scripts: any[], scriptName: string): string {
   const scriptResource = scripts.find(({name}) => name === scriptName)
   if (scriptResource === undefined) {
       throw new Error(`Script not found by name = ${scriptName}, available names = ${scripts.map(({name})=> name)}`)
   }
   return scriptResource.id
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