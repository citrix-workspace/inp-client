#!/usr/bin/env node

import 'isomorphic-fetch'
import * as fs from 'fs'
import {OptionValues, program} from 'commander'
import * as inpEndpoints from './inp-endpoints'
import {Buffer} from 'buffer'
import path from "path";
import {EndpointScript, EndpointsDefinition, EndpointsDefinitions} from "./types";

program
    .option('-p, --param [parameters...]', 'parameters')
    .option('-c, --create-integration <folder>', 'Create integration from payloads')
    .option('-r, --with-registration <withRegistration>', 'Create a new integration including registration', 'true')
    .option('-u, --update-scripts <folder>', 'Update scripts from existing saved integration.')
program.parse()

main(program.opts())
    .then(() => console.log('Done.'))
    .catch(error => console.error(`Failed with error: ${error}`))

async function main(args: OptionValues) {
    console.log(`main(${JSON.stringify(args)})`)
    const {
        createIntegration: createIntegrationFolder,
        updateScripts: updateScriptsFolder,
    }: {
        createIntegration?: string,
        updateScripts?: string,
    } = args
    if (createIntegrationFolder) {
        console.log(`Will create integration from ${args.createIntegration}`)
        return createIntegrationMain(createIntegrationFolder, args.withRegistration === 'true')
    } else if (updateScriptsFolder) {
        return updateScripts(updateScriptsFolder)
    } else {
        throw new Error(`Unsupported command: ${Object.keys(args).sort()}`)
    }
}

async function createIntegrationMain(bundleDefinitionFolder: string, withRegistration: boolean = true): Promise<any> {
    return inpEndpoints.createIntegration(loadResource('integration.json', bundleDefinitionFolder))
        .then(async integration => {
            const endpointDefinitions: EndpointsDefinitions = JSON.parse(loadResource('endpoints.json', bundleDefinitionFolder))
            const scriptResources = await Promise.all(endpointDefinitions.map(endpoint => createScriptsForEndpoint(integration.id, endpoint, bundleDefinitionFolder)).flat())
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
                return inpEndpoints.createEndpoints(result.integration.id, JSON.stringify(endpointScriptRequest))
            }))
            return ({...result, endpoints})
        })
        .then(async integration => {
            console.log(`Registration step: ${withRegistration}`)
            if (!withRegistration) {
                return integration
            }
            const registrationPayload = loadResource('registration.json', bundleDefinitionFolder)
            const registrationResource = await inpEndpoints.createRegistration(integration.integration.id, registrationPayload)
            return ({...integration, registration: registrationResource})
        })
        .then(result => {
            saveResource(formatJson(result), 'created-integration.json', bundleDefinitionFolder)
            console.log(`Integration id=${result.integration.id} created`)
            return result
        })
        .catch(error => console.error(`Create Integration failed: ${error} ${error.stack}`))
}

async function updateScripts(bundleDefinitionFolder: string): Promise<any> {
   const integration = JSON.parse(loadResource('created-integration.json', bundleDefinitionFolder))
   const scripts = integration
       .endpoints
       .flatMap((endpoint: any) => endpoint.endpointScripts)
       .map((endpoints: any) => endpoints.scriptId)
       .flatMap((scriptId: string) => integration
           .scripts
           .filter(((script: any) => script.id === scriptId)))
       .map((script: any) => ({
          ...script,
          scriptSource: loadScript(script.name, bundleDefinitionFolder)
       }))

    const results = await Promise.all(scripts.map(({id, name, scriptSource, _links}: any) => {
        const link = _links.find((link: any) => link.method.toLowerCase() === 'put')
        if (link === undefined) {
            return Promise.reject(new Error(`Script id=${id}, name=${name} does not contain link for PUT`))
        } else {
            return inpEndpoints.updateScript(id, link.href, scriptSource).then(() => `Script id=${id}, name=${name} was successfully updated.`)
        }
    }))
    console.log(results)
}

function createScriptsForEndpoint(integrationId: string, endpoint: EndpointsDefinition, bundleDefinitionFolder: string): Promise<any>[] {
    return endpoint.endpointScripts.map(endpointScript => createEndpointScript(integrationId, endpointScript, bundleDefinitionFolder))
}

function loadScript(scriptName: string, bundleDefinitionFolder: string): string {
    const scriptFileName = scriptName.toLocaleLowerCase().endsWith('.js') ? scriptName : `${scriptName}.js`
    const scriptRelativePath = path.join('scripts', scriptFileName)
    return loadResource(scriptRelativePath, bundleDefinitionFolder)
}

function createEndpointScript(integrationId: string, {scriptName}: EndpointScript, bundleDefinitionFolder: string): Promise<any> {
    return inpEndpoints.uploadJavascript(integrationId, scriptName, loadScript(scriptName, bundleDefinitionFolder))
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

function loadResource(name: string, folder: string = '.'): string {
    const fileName = path.join(path.resolve(folder), name)
    console.log(`Loading resource from ${fileName}`)
    return Buffer.from(fs.readFileSync(fileName)).toString()
}

function saveResource(content: string, name: string, folder: string = '.'): void {
    const fileName = path.join(path.resolve(folder), name)
    console.log(`Saving resource to ${fileName}`)
    fs.writeFileSync(fileName, content)
}

function logAsJson(object: any): any {
    console.log(formatJson(object))
    return object
}
