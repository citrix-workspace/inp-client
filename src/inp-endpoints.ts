import 'isomorphic-fetch'
import qs from 'qs'
import {getAppServiceUrl, getAuthToken, getIntegrationServiceUrl, getCustomerId, getUserId, getGatewayApiUrl} from './config'
import {getSuccessJson, getSuccessText} from "./lib/validation";
import {Dictionary} from "./types";

const contentTypeJsonHeader: Dictionary = {'Content-Type': 'application/json'}

function getDefaultPostOptions(authToken?: string): RequestInit {
    return ({
        method: 'POST',
        headers: {
            ...contentTypeJsonHeader,
            ...customerIdHeader(getCustomerId()),
            ...userIdHeader(getUserId()),
            ...isAdminHeader(!authToken),
            ...bearerAuthHeader(getAuthToken()),
        },
    })
}

function isAdminHeader(isAdmin: boolean): Dictionary {
    return isAdmin
        ? ({IsAdmin: isAdmin})
        : ({})
}

function customerIdHeader(customerId: string): Dictionary {
    return ({'Citrix-CustomerId': customerId})
}

function userIdHeader(userId?: string): Dictionary {
    return userId
        ? ({'Citrix-UserId': userId})
        : ({})
}

function bearerAuthHeader(token?: string): Dictionary {
    return token
        ? ({Authorization: `CWSAuth bearer=${token}`})
        : ({})
}

export function createIntegration(integrationPayload: string) {
    const url = `${getIntegrationServiceUrl()}/integrations`
    const defaultOptions = getDefaultPostOptions(getAuthToken())
    const options: RequestInit = {
        ...defaultOptions,
        body: integrationPayload,
    }
    console.log(`Creating integration (resource) at url=${url}`)
    return fetch(url, options)
        .then(getSuccessJson(async response =>  new Error(`Create integration failed: ${response.status} ${response.statusText} ${await response.text()}`)))
        .then(fillResourceId('integrations'))
}

export async function uploadJavascript(integrationId: string, scriptName: string, code: string): Promise<any> {
    const parameters = {
        name: scriptName,
        language: 'js'
    }
    const url = `${getIntegrationServiceUrl()}/integrations/${integrationId}/scripts?${qs.stringify(parameters)}`
    console.log(`Initial script ${scriptName} upload t url=${url}`)
    const defaultPostOptions = getDefaultPostOptions(getAuthToken())
    const options: RequestInit = {
        ...defaultPostOptions,
        headers: {...defaultPostOptions.headers, 'Content-Type': 'text/plain'},
        body: code,
    }
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Upload script ${scriptName} for integration id=${integrationId} failed`)))
}

export async function createEndpoints(integrationId: string, endpointsPayload: string) {
    console.log(`Creating endpoint ${JSON.parse(endpointsPayload).name}`)
    const url = `${getIntegrationServiceUrl()}/integrations/${integrationId}/endpoints`
    const options: RequestInit = {
        ...getDefaultPostOptions(getAuthToken()),
        body: endpointsPayload,
    }
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Create endpoints for integrationId=${integrationId} failed`)))
}

export async function createRegistration(integrationId: string, registrationPayload: string) {
    const url = `${getIntegrationServiceUrl()}/integrations/${integrationId}/registrations`
    console.log(`Creating registration url=${url}`)
    const options: RequestInit = {
        ...getDefaultPostOptions(getAuthToken()),
        body: registrationPayload,
    }
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Create registration for integrationId=${integrationId} failed`)))
    .then(fillResourceId('registrations'))
}

export async function createAuthConfig(integrationId: string, authConfigPayload: string) {
    const url = `${getIntegrationServiceUrl()}/integrations/${integrationId}/authConfigurations`
    const options: RequestInit = {
        ...getDefaultPostOptions(getAuthToken()),
        body: authConfigPayload,
    }
    console.log(`Creating authConfigurations at url=${url}`)
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Create auth configuration for integrationId=${integrationId} failed`)))
}

export function updateScript(id: string, href: string, source: string): Promise<any> {
    const defaultPostOptions = getDefaultPostOptions(getAuthToken())
    const options: RequestInit = {
        ...defaultPostOptions,
        headers: {...defaultPostOptions.headers, 'Content-Type': 'text/plain'},
        method: 'PUT',
        body: source,
    }
    const url = getLinkUrl(href)
    console.log(`Updating script id=${id} at url=${url}`)
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Update scriptId=${id} failed.`)))
}

export function authenticate(integrationId: string): Promise<any> {
    const options: RequestInit = {
        ...getDefaultPostOptions(getAuthToken())
    }
    const url = `${getIntegrationServiceUrl()}/integrations/${integrationId}/authenticate`
    console.log(`Calling authenticate at url=${url}`)
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Authenticate failed`)))
}

export function postResults(integrationId: string, endpointId: string, payload: string) {
    const options: RequestInit = {
        ...getDefaultPostOptions(getAuthToken()),
        body: payload
    }
    const url = `${getIntegrationServiceUrl()}/integrations/${integrationId}/endpoints/${endpointId}/results`
    console.log(`Calling /results at url=${url} with payload=${payload}`)
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Post results from url=${url} failed`)))
}

function getResourceId(object: any, name: string): string {
    const pattern = RegExp(`/${name}/([^/]+)`)
    return object._links.map(({href}: { href: string }): (string|undefined) => {
        const matches = href.match(pattern)
        if (matches === null) {
            return undefined
        } else {
            return matches[1]
        }
    })
        .find((id: string) => !!id)
}

function fillResourceId(resourceName: string): any {
    return (object: any) => ({
        id: getResourceId(object, resourceName),
        ...object,
    })
}

/**
 * Hack to make URL from links when integration service is used as base URL instead of gateway API URL - strip leading /integrationservice
 * Accepts INP_BASE_URL like https://integration-service.region.domain.com or https://api.region.domain.com/integrationservice
 * @param link
 * @return absolute link URL
 */
function getLinkUrl(link: string): string {
    return getIntegrationServiceUrl().includes('integration-service')
        ? `${getIntegrationServiceUrl()}${link.replace('/integrationservice', '')}`
        : `${getGatewayApiUrl()}${link}`
}


////////////////////////
////   Feed cards  /////
////////////////////////

export function updateBladeTemplate(bladeTemplateId: string, template: string | object) {
    const url = `${getAppServiceUrl()}/api/bladeTemplates/${bladeTemplateId}`
    const options: RequestInit = {
        ...getDefaultPostOptions(getAuthToken()),
        method: 'PUT',
        body: typeof template === 'string' ? template : JSON.stringify(template)
    }
    console.log(`Updating BladeTemplate id=${bladeTemplateId}`)
    return fetch(url, options)
        .then(getSuccessText(`Can't update BladeTemplate id=${bladeTemplateId}`))
}

export function updateNotificationTemplate(notificationTemplateId: string, template: string | object) {
    const url = `${getAppServiceUrl()}/api/notificationTemplates/${notificationTemplateId}`
    const options: RequestInit = {
        ...getDefaultPostOptions(getAuthToken()),
        method: 'PUT',
        body: typeof template === 'string' ? template : JSON.stringify(template)
    }
    console.log(`Updating notificationTemplate id=${notificationTemplateId}`)
    return fetch(url, options)
        .then(getSuccessText(`Can't update notificationTemplate id=${notificationTemplateId}`))
}
