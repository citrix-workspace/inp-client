import {Endpoint} from './types'

export function fillEndPointId(endpoint: Endpoint): Endpoint {
  const endpointId = endpoint.endpointScripts.map(({endpointId}) => endpointId).find((id) => id)!!
  return ({id: endpointId, ...endpoint})
}