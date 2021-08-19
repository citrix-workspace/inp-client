#!/usr/bin/env node

import 'isomorphic-fetch'
import * as fs from 'fs'
import * as _ from 'lodash'
import {OptionValues, program} from 'commander'
import * as inpEndpoints from './inp-endpoints'
import {Buffer} from 'buffer'
import path from "path";
import {EndpointsDefinitions} from "./types";
import {init as initConfig, getAuthToken} from "./config";

type CmdLineArgs = {
    createIntegration?: string,
    updateScripts?: string,
    fetchToken?: string,
    withRegistration: boolean,
    withAuthConfig: boolean,
    withAuth: boolean,
    envFile?: string,
}

program
    .option('-p, --param [parameters...]', 'parameters')
    .option('-c, --create-integration <folder>', 'Create integration from payloads')
    .option('-u, --update-scripts <folder>', 'Update scripts from existing saved integration.')
    .option('-t, --fetch-token <folder>', 'Only fetch auth token')
    .option('-r, --with-registration', 'Create a new integration including registration', false)
    .option('-f, --with-auth-config', 'Create a new integration including auth config derived from registration', false)
    .option('-a, --with-auth', 'Fetch auth token and add Authorization HTTP header', false)
    .option('-e, --env-file <name>','Overrides default .env file name', '.env')
program.parse()

main(program.opts())
    .then(() => console.log('Done.'))
    .catch(error => console.error(`Failed with error: ${error}`))

async function main(args: OptionValues) {
    console.log(`debug info main(${JSON.stringify(args)})`)
    const {
        createIntegration: createIntegrationFolder,
        updateScripts: updateScriptsFolder,
        fetchToken: fetchTokenFolder,
        withRegistration,
        withAuth,
        withAuthConfig,
        envFile,
    }: CmdLineArgs = args as any

    if (createIntegrationFolder) {
        console.log(`Will create integration from ${createIntegrationFolder} withRegistration=${withRegistration}, withAuthConfig=${withAuthConfig}, withAuth=${withAuth}`)
        await initConfig(createIntegrationFolder, envFile, withAuth)
        return createIntegrationMain(createIntegrationFolder!, withRegistration, args.withAuthConfig)
    } else if (updateScriptsFolder) {
        await initConfig(updateScriptsFolder, envFile, withAuth)
        return updateScripts(updateScriptsFolder)
    } else if (fetchTokenFolder) {
        await initConfig(fetchTokenFolder, envFile, true)
        const token = getAuthToken()
        console.log(`Got token=${token}`)
        saveResource(token!, 'token.txt', fetchTokenFolder)
    } else {
        throw new Error(`Cannot determine command from provided arguments: ${Object.keys(args).sort()}`)
    }
}

async function createIntegrationMain(bundleDefinitionFolder: string, withRegistration: boolean = false, withAuthConfig: boolean = false): Promise<any> {
        console.log('Create integration step')
        return inpEndpoints.createIntegration(loadResource('integration.json', bundleDefinitionFolder))
        .then(async integration => {
            const endpointDefinitions: EndpointsDefinitions = JSON.parse(loadResource('endpoints.json', bundleDefinitionFolder))
            const scriptNames = _.uniq(endpointDefinitions.flatMap(endpoint => endpoint.endpointScripts).map(script => script.scriptName))
            const scriptResources = await Promise.all(scriptNames.map(scriptName => createEndpointScript(integration.id, scriptName, bundleDefinitionFolder)))
            return ({integration, scripts: scriptResources, endpointDefinitions})
        })
        .then(async result => {
            console.log('Create endpoints step')
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
        .then(async integration => {
            console.log(`Auth config step: ${withAuthConfig}`)
            if (!withAuthConfig) {
                return integration
            }
            const registrationPayload = JSON.parse(loadResource('registration.json', bundleDefinitionFolder))
            const authConfigPayload = {
                oAuthConfiguration: registrationPayload.authConfig,
                useForNewRegistration: true,
            }
            const authConfigResource = await inpEndpoints.createAuthConfig(integration.integration.id, JSON.stringify(authConfigPayload))
            return ({...integration, authConfig: authConfigResource})
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
   const allScripts = integration
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
    const scripts = _.uniqBy(allScripts, 'id') as any
    console.log(`Scripts to update=${JSON.stringify(scripts.map(({id, name}: {id: string, name: string}) => ({id, name})))}`)

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

function loadScript(scriptName: string, bundleDefinitionFolder: string): string {
    const scriptFileName = scriptName.toLocaleLowerCase().endsWith('.js') ? scriptName : `${scriptName}.js`
    const scriptRelativePath = path.join('scripts', scriptFileName)
    return loadResource(scriptRelativePath, bundleDefinitionFolder)
}

function createEndpointScript(integrationId: string, scriptName: string, bundleDefinitionFolder: string): Promise<any> {
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
