Vertex Intelligence d3.js Test

**NOTE TO THE GRADER**:
Due to some part of the instructions for this assignment being unclear, I wrote this site on the following assumptions:
1) When creating a new node/line, the initial attributes for it (color, stroke, name, etc.) are based off of the 'parent' node/line type.
2) Due to healthy 'mistrust' of users to create unique names, I use a node/line ID as the unique value instead of the name. The name is set to the name of its type.
3) There is no other mention to bi-directionality for lines in the instructions, so it's a simple boolean value that doesn't really do anything. It can be changed per line though.
4) After changing the settings for node/line types, existing nodes/lines are NOT updated. Doing it this way would make it easy to accidentally *delete* any customizations made to existing nodes/lines.
5) When downloading a drawing, the background image comes with it. It doesn't really make sense to store the bounds, but not the image itself.
6) The default node and line types, as well as all node and line types are automatically saved to the browser's localStorage. This is for ease of use.
7) I thought it would make more sense to just store the start and end node ID's for each line, as it saves on data and speed, and also makes it so that if the position of a node is changed, so are the lines connected to it. Because of this, from_node_id and to_node_id coordinates *are* downloaded as per the instructions, however, are not used.
8) Lines must have 2 *existing* nodes to connect to. Therefore, when a node with line(s) connected to it is deleted, so are said line(s).
9) A dummy floor plan is included by default, along with another in the site's directory.

I appreciate the opportunity to do this test, as it has been fun to do, and I've learned quite a bit about d3 along the way.

After reviewing the requirements, they are all satisfied, and functional. The bonus items are also implemented, along with a few other things (localStorage, default node/line types) are implemented as I saw fit. 

For the first bonus feature, to change the visibility of the floor plan, alter the 'Show Floor Plan' checkbox in the title bar. To alter visibility of nodes and lines, see the checkbox in the settings menu for each type.

As per the second bonus feature, please see the `features` variable, which is used heavily throughout the program. It serves as the 'underlying JSON object' which is updated as per the assignment document. It would be pretty easy to add some AJAX in to sync this up with a server using a RESTful API.
