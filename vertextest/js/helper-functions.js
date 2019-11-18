// These are commonly called functions that were cluttering up index.js.

// Draw a line, given it and the svg container.
function drawLine(line, svg) {
    // Skip invisible lines
    if (line.invisible) return;

    for (let lineType of features.lineTypes) {
        if (line.lineTypeID === lineType.lineTypeID) {
            let startNode = findNode(line.startNodeID);
            let endNode = findNode(line.endNodeID);

            // Create the new line element
            let newLine = svg.append("line")
                .attr("x1", startNode.x)
                .attr("y1", startNode.y)
                .attr("x2", endNode.x)
                .attr("y2", endNode.y)
                .attr("stroke-width", line.weight)
                .attr("stroke", line.color);

            // Using line.weight below ensures that dotted and dashed lines don't look funky.
            if (line.stroke === "dashed") {
                newLine.style("stroke-dasharray", (line.weight * 3 + ", " + line.weight));
            } else if (line.stroke === "dotted") {
                newLine.style("stroke-dasharray", (line.weight + ", " + line.weight));
            }
        }
    }
}

// Draw a node, given it and the svg container.
function drawNode(node, svg) {
    // Skip invisible nodes
    if (node.invisible) return;

    let nodeElement;
    // Draw squares (rects)
    if (node.shape === "rect") {
        nodeElement = svg.append("rect")
            .attr("x", (node.x - node.size))
            .attr("y", (node.y - node.size))
            .attr("width", node.size * 2)
            .attr("height", node.size * 2)
            .style("fill", node.color)
            .call(d3.drag()
                .clickDistance(10)
                .on("start", dragStarted)
                .on("drag", dragged)
                .on("end", dragEnded)
            );
        // Draw circles
    } else if (node.shape === "circle") {
        nodeElement = svg.append("circle")
            .attr("cx", node.x)
            .attr("cy", node.y)
            .attr("r", node.size)
            .style("fill", node.color)
            .call(d3.drag()
                .clickDistance(10)
                .on("start", dragStarted)
                .on("drag", dragged)
                .on("end", dragEnded)
            );
    }
}

// Draw features into svg that are found in features.
function drawFeatures(features, svg) {
    // Make sure the width and height of the svg are correct.
    svg.width = features.floorPlanBounds.w;
    svg.height = features.floorPlanBounds.h;

    for (let line of features.lines) {
        drawLine(line, svg);
    }
    for (let node of features.nodes) {
        drawNode(node, svg);
    }
}

// Clears svg and redraws elements
function reset(svg) {
    clearDrawing();
    drawFeatures(features, svg);
}

// Wipe out any children of svg
function clearDrawing() {
    let canvas = document.querySelector("svg");

    while (canvas.firstChild) {
        canvas.removeChild(canvas.firstChild);
    }
}

//This function returns a nodeID if a click is within an existing node
function findNodeCollision(x, y) {
    for (let node of features.nodes) {
        // Skip invisible nodes
        if (node.invisible) continue;

        let dist = Math.hypot(x - node.x, y - node.y);

        if (dist < node.size) {
            return node.nodeID;
        }
    }
    return null;
}

//This function returns the nodeID closest to x, y
//It should only be called if 1+ nodes exist
function findClosestNode(x, y, maxDist) {
    let closestNodeID;
    let closestDist = Number.MAX_VALUE;

    for (let node of features.nodes) {
        // Skip invisible nodes
        if (node.invisible) continue;

        let dist = Math.hypot(x - node.x, y - node.y);

        if (dist < closestDist) {
            closestDist = dist;
            closestNodeID = node.nodeID;
        }
    }
    if (closestDist < maxDist) {
        return closestNodeID;
    } else return null;
}

//Finds a node in features.nodes from a nodeID
function findNode(nodeID) {
    for (let node of features.nodes) {
        if (node.nodeID === nodeID) return node;
    }
}

// Finds if x, y collide with a line provided a small buffer, and if so, returns its lineID
function findLineCollision(x, y) {
    const BUFFER = .5;
    for (let line of features.lines) {
        // Skip invisible lines
        if (line.invisible) continue;

        let startNode = findNode(line.startNodeID);
        let endNode = findNode(line.endNodeID);

        let d1 = Math.hypot(startNode.x - x, startNode.y - y);
        let d2 = Math.hypot(endNode.x - x, endNode.y - y);

        let totalDist = d1 + d2;
        let lineDist = Math.sqrt((Math.pow(startNode.x - endNode.x, 2) + Math.pow(startNode.y - endNode.y, 2)));

        if (totalDist >= lineDist - BUFFER && totalDist <= lineDist + BUFFER) {
            return line.lineID
        }
    }
}

// Return a line based on its ID
function findLine(lineID) {
    for (let line of features.lines) {
        if (lineID === line.lineID) return line;
    }
}

// Return a node type object based on its ID
function getNodeType(nodeTypeID) {
    for (let nodeType of features.nodeTypes) {
        if (nodeTypeID === nodeType.nodeTypeID) return nodeType;
    }
}

// Return a line type object based on its ID
function getLineType(lineTypeID) {
    for (let lineType of features.lineTypes) {
        if (lineTypeID === lineType.lineTypeID) return lineType;
    }
}

function deleteNode(node) {
    let nodeID;
    let nodeTooltip;
    // Depending on from where this is being called, we may or may not have the node parameter.
    // If not, use the one specified by the node tooltip.
    if (!node) {
        nodeTooltip = document.getElementById("node-tooltip");
        nodeID = nodeTooltip.nodeID;
    } else nodeID = node.nodeID;
    // Find the matching node and delete it.
    for (let i = 0; i < features.nodes.length; i++) {
        let node = features.nodes[i];
        if (node.nodeID === nodeID) {
            features.nodes.splice(i, 1);
        }
    }
    // We also need to check for any lines connected to that node. They will be deleted as well.
    for (let i = 0; i < features.lines.length; i++) {
        let line = features.lines[i];
        if (line.startNodeID === nodeID || line.endNodeID === nodeID) {
            features.lines.splice(i, 1);
        }
    }
    // Redraw
    reset(svg);
    nodeTooltip.style.display = "none";
    nodeTooltip.nodeID = null;
}

function deleteLine() {
    let lineTooltip = document.getElementById("line-tooltip");
    let lineID = lineTooltip.lineID;
    // Find the matching line and delete it.
    for (let i = 0; i < features.lines.length; i++) {
        let line = features.lines[i];
        if (line.lineID === lineID) {
            features.lines.splice(i, 1);
        }
    }
    // Redraw
    reset(svg);
    lineTooltip.style.display = "none";
    lineTooltip.nodeID = null;
}
