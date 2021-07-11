import 'isomorphic-fetch'
import qs from 'qs'
import {getSuccessJson, getSuccessText} from "./lib/validation";
import {INP_BASE_URL, CUSTOMER_ID, USER_ID} from "./config";
import {Dictionary} from "./types";

const contentTypeJsonHeader: Dictionary = {'Content-Type': 'application/json'}

const defaultPostOptions: RequestInit = {
    method: 'POST',
    headers: {
        ...contentTypeJsonHeader,
        ...customerIdHeader(CUSTOMER_ID),
        ...userIdHeader(USER_ID),
        ...isAdminHeader(true)
    },
}

function isAdminHeader(isAdmin: boolean): Dictionary {
    return {IsAdmin: isAdmin}
}

function customerIdHeader(customerId: string): Dictionary {
    return ({'Citrix-CustomerId': customerId})
}

function userIdHeader(userId: string): Dictionary {
    return ({'Citrix-UserId': userId})
}

export function createIntegration(integrationPayload: string) {
    const url = `${INP_BASE_URL}/integrations`
    const options: RequestInit = {
        ...defaultPostOptions,
        body: integrationPayload,
    }
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Create integration failed`)))
        .then(fillResourceId('integrations'))
}

export async function uploadJavascript(integrationId: string, scriptName: string, code: string): Promise<any> {
    const parameters = {
        name: scriptName,
        language: 'js'
    }
    const url = `${INP_BASE_URL}/integrations/${integrationId}/scripts?${qs.stringify(parameters)}`
    console.log(`uploadJavascript ${scriptName} url=${url}`)
    const options: RequestInit = {
        ...defaultPostOptions,
        headers: {...defaultPostOptions.headers, 'Content-Type': 'text/plain'},
        body: code,
    }
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Upload script ${scriptName} for integration id=${integrationId} failed`)))
}

export async function createEndpoints(integrationId: string, endpointsPayload: string) {
    const url = `${INP_BASE_URL}/integrations/${integrationId}/endpoints`
    // console.log(`createEndpoints url=${url}, payload=${endpointsPayload}`)
    const options: RequestInit = {
        ...defaultPostOptions,
        body: endpointsPayload,
    }
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Create endpoints for integrationId=${integrationId} failed`)))
}

export async function createRegistration(integrationId: string, registrationPayload: string) {
    const url = `${INP_BASE_URL}/integrations/${integrationId}/registrations`
    // console.log(`createRegistration url=${url}, payload=${registrationPayload}`)
    const options: RequestInit = {
        ...defaultPostOptions,
        body: registrationPayload,
    }
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Create registration for integrationId=${integrationId} failed`)))
    .then(fillResourceId('registrations'))
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