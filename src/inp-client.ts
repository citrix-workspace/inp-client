#!/usr/bin/env node

import 'isomorphic-fetch'
import * as fs from 'fs'
import * as _ from 'lodash'
import {OptionValues, program} from 'commander'
import {Buffer} from 'buffer'
import path from 'path'
import chalk from 'chalk'
import mustache from 'mustache'
import * as inpEndpoints from './inp-endpoints'
import {
    EndpointScriptDefinition,
    EndpointScript,
    EndpointsDefinition,
    Endpoint,
    SavedIntegration, Script
} from "./types";
import {
  init as initConfig,
  getAuthToken,
  getUserId,
  getCustomerId,
  getGatewayApiUrl, getIntegrationServiceUrl,
} from './config'
import {updateBladeTemplate, updateNotificationTemplate} from "./inp-endpoints";
import Mustache from 'mustache'

const createdIntegrationFileName = 'created-integration.json'

type CmdLineArgs = {
    createIntegration?: string,
    updateScripts?: string,
    fetchToken?: string,
    withRegistration: boolean,
    withAuthConfig: boolean,
    withAuth: boolean,
    authenticate?: string,
    postResults?: string,
    payload?: string,
    printSummary?: string,
    updateFeedCard: string,
    envFile?: string,
}

program
    .option('-c, --create-integration <folder>', 'Create integration from payloads')
    .option('-u, --update-scripts <folder>', 'Update scripts from existing saved integration.')
    .option('-t, --fetch-token <folder>', 'Only fetch auth token')
    .option('-r, --with-registration', 'Create a new integration including registration', false)
    .option('-f, --with-auth-config', 'Create a new integration including auth config derived from registration', false)
    .option('-a, --with-auth', 'Fetch auth token and add Authorization HTTP header', false)
    .option('-t, --authenticate <folder>', `Calls /authenticate endpoint and prints OAuth URL`)
    .option('-p, --post-results <folder>', `Calls /results endpoint and prints the response`)
    .option('-l, --payload <file>', `File name to to load payload from`)
    .option('--update-feed-card <folder>', `Update feed card`)
    .option('-s, --print-summary <folder>', `Prints created integration summary from saved resource ${createdIntegrationFileName}`)
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
        authenticate: authenticateFolder,
        postResults: postResultsFolder,
        payload: payloadFileName,
        printSummary: printSummaryFolder,
        updateFeedCard: updateFeedCardFolder,
        envFile,
    }: CmdLineArgs = args as CmdLineArgs

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
    } else if (authenticateFolder) {
        await initConfig(authenticateFolder, envFile, withAuth)
        return authenticateMain(authenticateFolder)
    } else if (printSummaryFolder) {
        await initConfig(printSummaryFolder, envFile, withAuth)
        return printSummaryMain(printSummaryFolder)
    } else if (postResultsFolder) {
        await initConfig(postResultsFolder, envFile, withAuth)
        return postResultsMain(postResultsFolder, payloadFileName)
    } else if (updateFeedCardFolder) {
        await initConfig(updateFeedCardFolder, envFile, withAuth)
        return updateFeedCard(updateFeedCardFolder)
    } else {
        throw new Error(`Cannot determine command from provided arguments: ${Object.keys(args).sort()}`)
    }
}

async function createIntegrationMain(bundleDefinitionFolder: string, withRegistration: boolean = false, withAuthConfig: boolean = false): Promise<any> {
        console.log('Create integration step')
        return inpEndpoints.createIntegration(loadResource('integration.json', bundleDefinitionFolder))
        .then(async integration => {
            const endpointDefinitions: EndpointsDefinition[] = JSON.parse(loadResource('endpoints.json', bundleDefinitionFolder))
            const scriptNames = _.uniq(endpointDefinitions.flatMap(endpoint => endpoint.endpointScripts).map((script: EndpointScriptDefinition) => script.scriptName))
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
            function fillEndPointId(endpoint: Endpoint): Endpoint {
                const endpointId = endpoint.endpointScripts.map(({endpointId}) => endpointId).find((id) => id)!!
                return ({id: endpointId, ...endpoint})
            }
            return ({...result, endpoints: endpoints.map(fillEndPointId)})
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
            saveResource(formatJson(result), createdIntegrationFileName, bundleDefinitionFolder)
            printSummaryMain(bundleDefinitionFolder)
            return result
        })
        .catch(error => console.error(`Create Integration failed: ${error} ${error.stack}`))
}

async function updateScripts(bundleDefinitionFolder: string): Promise<any> {
   const integration = loadSavedIntegration(bundleDefinitionFolder)
   const allScripts = integration
       .endpoints
       .flatMap((endpoint: Endpoint) => endpoint.endpointScripts)
       .map((endpoints: EndpointScript) => endpoints.scriptId)
       .flatMap((scriptId: string) => integration
           .scripts
           .filter(((script: Script) => script.id === scriptId)))
       .map((script: Script) => ({
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
    console.log(`Script updates results: ${results.join(', ')}`)
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

function loadResource(name?: string, folder: string = '.'): string {
    if (!name) {
        throw new Error(`loadResource is missing required argument 'name'`)
    }
    const fileName = path.join(path.resolve(folder), name)
    console.log(`Loading resource from ${fileName}`)
    return Buffer.from(fs.readFileSync(fileName)).toString()
}

function saveResource(content: string, name: string, folder: string = '.'): void {
    const fileName = path.join(path.resolve(folder), name)
    console.log(`Saving resource to ${fileName}`)
    fs.writeFileSync(fileName, content)
}

function loadSavedIntegration(bundleDefinitionFolder: string): SavedIntegration {
    return JSON.parse(loadResource(createdIntegrationFileName, bundleDefinitionFolder))
}

function authenticateMain(bundleFolder: string): Promise<any> {
    const integration = loadSavedIntegration(bundleFolder)
    return inpEndpoints.authenticate(integration.integration.id)
        .then((authResponse) => {
            console.log(`Auth url=${authResponse.url}`)
            saveResource(authResponse.url, 'auth-url.txt', bundleFolder)
        })
}

function printSummaryMain(bundleDefinitionFolder: string): void {
    const print = (...args: any[]) => console.log(chalk.green(...args))
    const integration = loadSavedIntegration(bundleDefinitionFolder)
    const integrationId = integration.integration.id
    print('*** Integration summary ***')
    print(`gatewayApiUrl=${getGatewayApiUrl()}`)
    print(`integrationServiceUrl=${getIntegrationServiceUrl()}`)
    print(`customerId=${getCustomerId()}`)
    print(`userId=${getUserId()}`)
    print('Integration:')
    print(`\tintegrationId=${integrationId}`)
    print('Endpoints:')
    function formatEndpointScripts({scriptId, functionName, endpointScriptType}: EndpointScript): string {
        return `\n\t\tscriptId=${scriptId} functionName=${functionName} endpointScriptType=${endpointScriptType}`
    }
    integration.endpoints.forEach(endpoint => print(
        `\tendpointId=${endpoint.id} name=${endpoint.name
        }\n\tEndpoint scripts:${
           endpoint.endpointScripts.map(formatEndpointScripts)}`))
    print(`registrationId=${integration.registration?.id}`)
}

function postResultsMain(bundleFolder: string, payloadFileName?: string): Promise<void> {
    const {integration: {id: integrationId}, endpoints} = loadSavedIntegration(bundleFolder)
    const onDemandEndpoint = endpoints.find(endpoint => endpoint.endpointType.toLowerCase() === 'ondemand' && endpoint.category.toLowerCase() === 'search')!!
    // TODO validate that there are no more onDemand endpoints
    const endpointId = onDemandEndpoint.endpointScripts.map(({endpointId}) => endpointId).find(id => id != null)!!
    const payload = loadResource(payloadFileName, bundleFolder)
    return inpEndpoints.postResults(integrationId, endpointId, payload)
        .then(result => {
            console.log('Results:')
            try {
                logAsJson(result)
            } catch (e) {
                console.log(result)
            }
            return result
        })
}

async function updateFeedCard(bundleFolder: string): Promise<void> {
    const integration = loadSavedIntegration(bundleFolder)
    const {feeds} = integration
    await Promise.all(Object.keys(feeds)
      .map(feedName => ({feedName, ...feeds[feedName]}))
      .map(async ({feedName, blade, notification}) => {
        // customTags could be configured Mustache.tags = ['%', '%' ]
        const bladeTemplateResource = mustache.render(loadResource(path.join('feeds', `blade_${feedName}.json`), bundleFolder), {}, {},  [ '%', '%' ] )
        // const bladeTemplateResource = loadResource(path.join('feeds', `blade_${feedName}.json`), bundleFolder).replace('%BLADE_ID%', blade.id)
        console.log(`updating blade ${bladeTemplateResource}`)
        await updateBladeTemplate(blade.id, bladeTemplateResource)
        console.log(`Blade for ${feedName} updated with saved blade meta ${JSON.stringify(blade)}`)

        const notificationResource = mustache.render(loadResource(path.join('feeds', `notification_${feedName}.json`), bundleFolder), {'BLADE_ID': blade.id}, {},  [ '%', '%' ])
        console.log(`updating notification\n\n${JSON.stringify(JSON.parse(notificationResource), null, 2)}\n\n`)
        await updateNotificationTemplate(notification.id, notificationResource)
        console.log(`Notification for ${feedName} updated, saved notification meta ${JSON.stringify(notification)}, notification to update: ${notificationResource}`)
      }))
}

function logAsJson(object: any): any {
    console.log(formatJson(object))
    return object
}
