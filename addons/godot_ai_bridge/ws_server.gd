@tool
extends Node
## WebSocket server for AI Bridge

signal message_received(peer_id: int, message: String)
signal client_connected(peer_id: int)
signal client_disconnected(peer_id: int)

var port: int = 6550

var _tcp_server: TCPServer
var _ws_peers: Dictionary = {}  # peer_id -> {peer: WebSocketPeer, stream: StreamPeerTCP}
var _timer: Timer


func _ready() -> void:
	pass


func start() -> Error:
	_tcp_server = TCPServer.new()
	var err = _tcp_server.listen(port, "127.0.0.1")
	if err != OK:
		return err

	_timer = Timer.new()
	_timer.wait_time = 0.016
	_timer.timeout.connect(_poll)
	add_child(_timer)
	_timer.start()

	print("[AI Bridge] Timer started for polling")
	return OK


func stop() -> void:
	if _timer:
		_timer.stop()
		_timer.queue_free()
		_timer = null

	for peer_id in _ws_peers.keys():
		_ws_peers[peer_id]["peer"].close()
	_ws_peers.clear()

	if _tcp_server:
		_tcp_server.stop()
		_tcp_server = null


func _poll() -> void:
	# Accept new TCP connections and immediately create WebSocketPeer
	while _tcp_server and _tcp_server.is_connection_available():
		var stream = _tcp_server.take_connection()
		if stream:
			print("[AI Bridge] New TCP connection!")
			var ws_peer = WebSocketPeer.new()
			# Let WebSocketPeer handle the handshake itself
			var err = ws_peer.accept_stream(stream)
			if err == OK:
				var peer_id = stream.get_instance_id()
				_ws_peers[peer_id] = {"peer": ws_peer, "stream": stream, "connected": false}
				print("[AI Bridge] WebSocket peer created, waiting for handshake...")
			else:
				print("[AI Bridge] Failed to accept stream: ", err)

	# Process WebSocket peers
	var to_remove: Array = []
	for peer_id in _ws_peers.keys():
		var data = _ws_peers[peer_id]
		var peer: WebSocketPeer = data["peer"]

		peer.poll()
		var state = peer.get_ready_state()

		if state == WebSocketPeer.STATE_OPEN:
			if not data["connected"]:
				data["connected"] = true
				print("[AI Bridge] Client connected: ", peer_id)
				client_connected.emit(peer_id)

			while peer.get_available_packet_count() > 0:
				var packet = peer.get_packet()
				var msg = packet.get_string_from_utf8()
				print("[AI Bridge] Received message: ", msg.substr(0, 80))
				message_received.emit(peer_id, msg)

		elif state == WebSocketPeer.STATE_CLOSED:
			print("[AI Bridge] Client disconnected: ", peer_id)
			to_remove.append(peer_id)
			client_disconnected.emit(peer_id)

	for peer_id in to_remove:
		_ws_peers.erase(peer_id)


func send_message(peer_id: int, message: String) -> Error:
	if not _ws_peers.has(peer_id):
		return ERR_DOES_NOT_EXIST

	var peer: WebSocketPeer = _ws_peers[peer_id]["peer"]
	if peer.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return ERR_CONNECTION_ERROR

	print("[AI Bridge] Sending message: ", message.substr(0, 80))
	return peer.send_text(message)
