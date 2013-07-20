var io,
	user_list,

	games = {
		star: [
			[122,	317,	107,	315],	/* 1  */
			[154,	224,	139,	220],	/* 2  */
			[74,	164,	60,		160],	/* 3  */
			[171,	164,	160,	148],	/* 4  */
			[200,	74,		198,	57],	/* 5  */
			[231,	164,	236,	148],	/* 6  */
			[328,	164,	336,	160],	/* 7  */
			[250,	224,	260,	220],	/* 8  */
			[280,	317,	289,	314],	/* 9  */
			[200,	260,	195,	270],	/* 10 */
			[154,	224,	165,	220],	/* 11 */
			[171,	164,	177,	174],	/* 12 */
			[231,	164,	215,	174],	/* 13 */
			[250,	224,	230,	220],	/* 14 */
			[200,	260,	195,	242],	/* 15 */
			[122,	317,	130,	317]	/* 16 */
		]
	},

	game_sessions = {}
;

function generateID(store) {
	var id;
	do {
		id = Math.round(Math.random()*1E9);
	} while (id in store);
	store[id] = true;
	return id;
}

function getGame() {
	var game_names = Object.keys(games),
		which_game = Math.round(Math.random() * 1000) % game_names.length
	;

	return games[game_names[which_game]];
}

function connection(socket) {

	function user(userID,gameID) {
		if (user_list[userID] && user_list[userID].connected) {
			user_id = userID;

			if (
				gameID && game_sessions[gameID] &&
				(
					!game_id ||
					game_id === gameID
				)
			) {
				game_id = gameID;
				user_list[user_id].game = gameID;
				if (!~game_sessions[game_id].users.indexOf(user_id)) {
					game_sessions[game_id].users.push(user_id);
				}
				socket.join(game_id);
			}
			else {
				game_id = generateID(game_sessions);
				game_sessions[game_id] = {
					data: getGame(),
					users: [user_id],
					started: false
				};
				user_list[user_id].game = game_id;
				socket.join(game_id);
			}

			socket.emit("game_id",game_id);

			// are both users joined to the same game now?
			if (game_sessions[game_id].users.length === 2) {
				game_sessions[game_id].started = true;
				io.of("/game").in(game_id).emit("game_data",game_sessions[game_id].data);
			}
		}
		else {
			socket.emit("invalid_game");
			doDisconnect();
		}
	}

	function killSocket() {
		socket.removeListener("user",user);
		socket.removeListener("disconnect",disconnected);
	}

	function disconnected() {
		if (user_id && user_list[user_id]) {
			user_list[user_id].game = null;

			if (game_id) {
				socket.leave(game_id);

				if (game_sessions[game_id]) {
					// remove current user from the game
					game_sessions[game_id].users =
						game_sessions[game_id].users.filter(function(userID){
							return userID !== user_id;
						})
					;

					// if the game has no more users, clean up the record
					if (game_sessions[game_id].users.length === 0) {
						delete game_sessions[game_id];
					}
					// otherwise notify other user(s) about game end
					else if (game_sessions[game_id].started) {
						game_sessions[game_id].started = false;
						socket.broadcast.to(game_id).emit("game_ended",game_id);
					}
				}

				user_id = game_id = null;
			}
		}

		if (socket) {
			killSocket();
			socket = null;
		}
	}

	function doDisconnect() {
		if (socket) {
			killSocket();
			disconnected();
			socket.disconnect();
			socket = null;
		}
	}

	var user_id,
		game_id
	;

	socket.on("user",user);
	socket.on("disconnect",disconnected);
}


function init(socketio,users) {
	io = socketio;
	user_list = users;

	io.of("/game").on("connection",connection);
}

exports.init = init;
