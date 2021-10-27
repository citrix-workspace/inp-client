import 'isomorphic-fetch'
import qs from 'qs'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import {Dictionary} from "./types";
import {getSuccessJson} from "./lib/validation";

const config: {
    integrationServiceUrl?: string,
    appServiceUrl?: string,
    customerId?: string,
    userId?: string,
    clientId?: string,
    clientSecret?: string,
    gatewayApiUrl?: string,
    authToken?: string,
} = {}

export async function init(envFolder: string = '.', envName: string = '.env', withAuth: boolean = false) {
    const envPath = path.resolve(envFolder, envName)
    if (fs.existsSync(envPath)) {
        const result = dotenv.config({path: envPath})
        if (result.error) {
            throw new Error(`Cannot parse env from path=${envPath}: ${result.error}`)
        }
        console.log(`env variables loaded from ${envPath}`)
    } else {
        console.log(`.env file ${envPath} resolved from ${envName} does not exists. Skipping processing env variables using ${envName}.`)
    }

    const {
        INP_BASE_URL,
        INTEGRATION_SERVICE_URL,
        CUSTOMER_ID,
        USER_ID,
        CLIENT_ID,
        CLIENT_SECRET,
        TRUST_AUTH_URL,
        GATEWAY_API_URL,
        APP_SERVICE_URL,
    }: Dictionary = process.env

    config.integrationServiceUrl = INTEGRATION_SERVICE_URL || INP_BASE_URL
    if (INP_BASE_URL && !INTEGRATION_SERVICE_URL) {
      console.warn(`*** INP_BASE_URL is deprecated, please rename it to INTEGRATION_SERVICE_URL, used url=${config.integrationServiceUrl} ***`)
    } else if (INP_BASE_URL && INTEGRATION_SERVICE_URL) {
      console.warn(`INP_BASE_URL is deprecated, INTEGRATION_SERVICE_URL is used instead, used url=${config.integrationServiceUrl}.`)
    }
    config.customerId = CUSTOMER_ID
    config.userId = USER_ID
    config.clientId = CLIENT_ID
    config.clientSecret = CLIENT_SECRET
    config.gatewayApiUrl = GATEWAY_API_URL || TRUST_AUTH_URL
    config.appServiceUrl = APP_SERVICE_URL

    if (TRUST_AUTH_URL && !GATEWAY_API_URL) {
      console.warn(`*** TRUST_AUTH_URL is deprecated, please rename it to GATEWAY_API_URL, used url=${config.gatewayApiUrl} ***`)
    } else if (TRUST_AUTH_URL && GATEWAY_API_URL) {
      console.warn(`TRUST_AUTH_URL is deprecated, GATEWAY_API_URL is used instead, used url=${config.gatewayApiUrl}`)
    }

    if (withAuth) {
        config.authToken = await fetchAuthToken()
    }
}

export function getIntegrationServiceUrl(): string {
  const url = getValue(config, 'integrationServiceUrl')
  if (url) {
    return url
  } else {
    return `${getGatewayApiUrl()}/integrationservice`
  }
}

export function getAppServiceUrl(): string {
    return notEmpty(config, 'appServiceUrl')
}


export function getUserId(): string | undefined {
    return getValue(config, 'userId')
}

export function getCustomerId(): string {
    return notEmpty(config, 'customerId')
}

export function getClientId() {
    return notEmpty(config, 'clientId')
}

export function getClientSecret() {
    return notEmpty(config, 'clientSecret')
}

export function getGatewayApiUrl() {
    return notEmpty(config, 'gatewayApiUrl')
}

export function getAuthToken() {
    return getValue(config, 'authToken')
}

function getValue(config: Dictionary, name: string): string | undefined {
    return config[name]
}

function notEmpty(config: Dictionary, name: string): string {
    const value = getValue(config, name)
    if (value === undefined) {
        throw new Error(`Value '${name}' is undefined`)
    }
    if (value === null) {
        throw new Error(`Value '${name}' is null`)
    }
    if (value.trim() === '') {
        throw new Error(`Value '${name}' is empty`)
    }
    return value
}

function fetchAuthToken(): Promise<string> {
    const options: RequestInit = {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
            "Citrix-CustomerId": getCustomerId(),
        },
        body: qs.stringify({
            grant_type: "client_credentials",
            client_id: getClientId(),
            client_secret: getClientSecret(),
        }),
    };
    const url = `${getGatewayApiUrl()}/cctrustoauth2/${getCustomerId()}/tokens/clients`
    console.log(`Fetching token from ${url}, with payload=${options.body}`)
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Can't get bearer token for ${getClientId()}`)))
        .then((responseBody) => responseBody.access_token);
}