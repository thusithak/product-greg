
/*
 * Copyright (c) 2014, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/*
Method to generate data structure necessary to render the dependency graph

param registry : user-registry instance create on the logged in user's session
param resourcePath : Source path to start data structure
param graph : is an json object having to attributes nodes and edges
 */
function getNodesAndEdges(registry, userName, resourcePath, graph){
    var util = require('/extensions/app/greg_impact/modules/utility.js');
    var governanceUtils = Packages.org.wso2.carbon.governance.api.util.GovernanceUtils;

    var govRegistry = governanceUtils.getGovernanceUserRegistry(registry.registry, userName);

    var artifactPath = resourcePath.replace("/_system/governance", "");

    var artifact = governanceUtils.retrieveGovernanceArtifactByPath(
        govRegistry, artifactPath);

    if (artifact){
        var graphDataObject = new Object();

        if (graph.nodes[resourcePath]){
            graphDataObject = graph.nodes[resourcePath]
        }
        else{

            graphDataObject = createNode(resourcePath, artifact, graph.index);

            graph.index++;

            graph.nodes[resourcePath] = graphDataObject;
            graph.nodes.push(graphDataObject);


            var associations = registry.associations(resourcePath);
            for (var i = 0; i < associations.length; i++) {
                if (util.isNotNullOrEmpty(associations[i].src)){
                    if (associations[i].src == resourcePath){
                        var resourceDest = associations[i].dest;

                        if(getNodesAndEdges(registry, userName, resourceDest, graph)){
                            
                            var relation = createRelation(graphDataObject.id, graph.nodes[resourceDest].id, associations[i].type, graph.relationIndex);

                            graph.relations.push(relation);

                            graphDataObject.relations.push(relation.id);

                            var edge;

                            if (graph.edges[graphDataObject.id + "," + graph.nodes[resourceDest].id]){

                                edge = graph.edges[graphDataObject.id + "," + graph.nodes[resourceDest].id];
                                edge.relations.push(relation.id);

                            }
                            else{
                                
                                edge = createEdge(graphDataObject.id, graph.nodes[resourceDest].id);
                                edge.source = graphDataObject.id;
                                edge.relations.push(relation.id);

                                graph.edges[graphDataObject.id + "," + graph.nodes[resourceDest].id] = edge;
                                graph.edges[graph.nodes[resourceDest].id + "," + graphDataObject.id] = edge;

                                graph.edges.push(edge);
                            }

                            graph.relationIndex++;
                        }
                    }
                }
            }
        }

        return true;

    }
    return false;
}

function createRelation(sourceID, targetID, relationType, relationID){
    var relation = new Object();

    relation.source = sourceID;
    relation.target = targetID;
    relation.relation = relationType;
    relation.id = relationID;

    return relation;
}

function createEdge(sourceID, targetID){
    edge = new Object();

    edge.source = sourceID;
    edge.target = targetID;
    edge.value = 1;
    edge.relations = [];

    return edge;
}

function createNode(resourcePath, artifact, nodeID){
    var wsdl = Packages.org.wso2.carbon.governance.api.wsdls.dataobjects.WsdlImpl,
        schema = Packages.org.wso2.carbon.governance.api.schema.dataobjects.SchemaImpl,
        policy = Packages.org.wso2.carbon.governance.api.policies.dataobjects.PolicyImpl,
        endpoint = Packages.org.wso2.carbon.governance.api.endpoints.dataobjects.EndpointImpl
        GovernanceConstants = Packages.org.wso2.carbon.governance.api.util.GovernanceConstants;

    var graphDataObject = new Object();

    var artifactName= artifact.getAttributes("overview_name");;
    /*
     If the artifact's overview_name is not exist, resource name is extracted
     from the resourcePath provided.
     */
    graphDataObject.name = (artifactName == null) ?
        resourcePath.substring(resourcePath.lastIndexOf("/") + 1) :
        artifactName[0];

    //added in order to populate select2 drop down
    graphDataObject.text = graphDataObject.name;

    var mediaType;
    if (util.isNotNullOrEmpty(artifact.mediaType)){
        mediaType = artifact.mediaType;
    }
    else {
        /*
         If mediatype is not available as an attribute in artifact,
         then retrieved artifact cam be a content artifact.
         */
        if (artifact instanceof wsdl){
            mediaType = GovernanceConstants.WSDL_MEDIA_TYPE;
        }
        else if (artifact instanceof schema){
            mediaType = GovernanceConstants.SCHEMA_MEDIA_TYPE;
        }
        else if (artifact instanceof policy){
            mediaType = GovernanceConstants.POLICY_XML_MEDIA_TYPE;
        }
        else if (artifact instanceof endpoint){
            mediaType = GovernanceConstants.ENDPOINT_MEDIA_TYPE;
        }
        else{
            /*
            If the mediaType cannot be determind by considering the retrieved
            artifact as a conent artifact last option is to retrieve the 
            registry resource related to the given artifact and retrieve 
            mediaType from the registry resource.
            */
            mediaType = registry.registry.get(resourcePath).getMediaType();
        }
    }

    graphDataObject.nodeType = (graph.index == 0) ? 'parent' : 'child';
    graphDataObject.mediaType = mediaType;
    graphDataObject.path = resourcePath;
    graphDataObject.relations = [];
    graphDataObject.id = nodeID;

    return graphDataObject;
}
