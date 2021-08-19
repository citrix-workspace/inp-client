import 'isomorphic-fetch'
import qs from 'qs'
import {getSuccessJson} from "./lib/validation";
import {getAuthToken, getBaseUrl, getCustomerId, getUserId} from "./config";
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
    const url = `${getBaseUrl()}/integrations`
    const defaultOptions = getDefaultPostOptions(getAuthToken())
    const options: RequestInit = {
        ...defaultOptions,
        body: integrationPayload,
    }
    return fetch(url, options)
        .then(getSuccessJson(async response =>  new Error(`Create integration failed: ${await response.text()}`)))
        .then(fillResourceId('integrations'))
}

export async function uploadJavascript(integrationId: string, scriptName: string, code: string): Promise<any> {
    const parameters = {
        name: scriptName,
        language: 'js'
    }
    const url = `${getBaseUrl()}/integrations/${integrationId}/scripts?${qs.stringify(parameters)}`
    console.log(`uploadJavascript ${scriptName} url=${url}`)
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
    const url = `${getBaseUrl()}/integrations/${integrationId}/endpoints`
    const options: RequestInit = {
        ...getDefaultPostOptions(getAuthToken()),
        body: endpointsPayload,
    }
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Create endpoints for integrationId=${integrationId} failed`)))
}

export async function createRegistration(integrationId: string, registrationPayload: string) {
    const url = `${getBaseUrl()}/integrations/${integrationId}/registrations`
    // console.log(`createRegistration url=${url}, payload=${registrationPayload}`)
    const options: RequestInit = {
        ...getDefaultPostOptions(getAuthToken()),
        body: registrationPayload,
    }
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Create registration for integrationId=${integrationId} failed`)))
    .then(fillResourceId('registrations'))
}

export async function createAuthConfig(integrationId: string, authConfigPayload: string) {
    const url = `${getBaseUrl()}/integrations/${integrationId}/authConfigurations`
    const options: RequestInit = {
        ...getDefaultPostOptions(getAuthToken()),
        body: authConfigPayload,
    }
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Create auth configuration for integrationId=${integrationId} failed`)))
}

export function updateScript(id: string, href: string, source: string): Promise<any> {
    // hack to make URL from links when integration service is used as base URL instead of gateway API URL - strip leading /integrationservice
    const url = getBaseUrl().includes('integration-service')
        ? `${getBaseUrl()}${href.replace('/integrationservice', '')}`
        : `${getBaseUrl()}${href}`
    const defaultPostOptions = getDefaultPostOptions()
    const options: RequestInit = {
        ...defaultPostOptions,
        headers: {...defaultPostOptions.headers, 'Content-Type': 'text/plain'},
        method: 'PUT',
        body: source,
    }
    console.log(`updateScript id=${id} at url=${url}`)
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Update scriptId=${id} failed.`)))
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
        ...object,
        id: getResourceId(object, resourceName)
    })
}