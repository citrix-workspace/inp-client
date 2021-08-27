export type Dictionary = {
    [key: string]: any
}

/*
 Integration bundle
 */
export interface EndpointScriptDefinition {
    scriptName: string,
    functionName: string,
    endpointScriptType: 'onExecution'
}

export interface EndpointsDefinition {
    name: string,
    httpMethod: 'Post' | 'Put' | 'Get' | 'Delete',
    endpointType: 'onDemand' | 'onSubscribe',
    category: string,
    endpointScripts: EndpointScriptDefinition[]
}

/* Integration resources */

export interface EndpointScript {
    endpointId: string,
    scriptId: string,
    functionName: string,
    endpointScriptType: 'OnExecution'
}

export interface Endpoint {
    id?: string,
    name: string,
    httpMethod: 'Post' | 'Put' | 'Get' | 'Delete',
    endpointType: 'onDemand' | 'onSubscribe',
    category: string,
    endpointScripts: EndpointScript[]
}

export interface Script {
    id: string,
    name: string,
}

export interface IntegrationResource {
    id: string,
}

export interface Registration {
    id: string,
}

export interface SavedIntegration {
    integration: IntegrationResource,
    endpoints: Endpoint[],
    scripts: Script[],
    registration: Registration,
}