@tool
extends RefCounted
## Handles JSON-RPC messages for AI Bridge

var editor_interface: EditorInterface
var undo_redo: EditorUndoRedoManager
var output_buffer: Array[String] = []
var error_buffer: Array[Dictionary] = []
const MAX_OUTPUT_LINES: int = 500
const MAX_ERROR_COUNT: int = 100


func handle_message(message: String) -> String:
	var json = JSON.new()
	var parse_err = json.parse(message)

	if parse_err != OK:
		return _error_response(null, -32700, "Parse error")

	var data = json.data
	if not data is Dictionary:
		return _error_response(null, -32600, "Invalid Request")

	var request: Dictionary = data
	var id = request.get("id")
	var method = request.get("method", "")
	var params = request.get("params", {})

	if not method is String or method.is_empty():
		return _error_response(id, -32600, "Invalid method")

	if not params is Dictionary:
		params = {}

	var result = _dispatch(method, params)

	if result.has("error"):
		return _error_response(id, result["error"]["code"], result["error"]["message"])

	return _success_response(id, result.get("result"))


func _dispatch(method: String, params: Dictionary) -> Dictionary:
	match method:
		"initialize":
			return _handle_initialize(params)
		"scene_tree.get":
			return _handle_get_scene_tree(params)
		"scene_tree.add_node":
			return _handle_add_node(params)
		"scene_tree.remove_node":
			return _handle_remove_node(params)
		"scene_tree.modify_node":
			return _handle_modify_node(params)
		"editor.open_scene":
			return _handle_open_scene(params)
		"editor.save_scene":
			return _handle_save_scene(params)
		"editor.run_scene":
			return _handle_run_scene(params)
		"editor.stop_scene":
			return _handle_stop_scene(params)
		"info.project":
			return _handle_get_project_info(params)
		"fs.refresh":
			return _handle_refresh_filesystem(params)
		"info.errors":
			return _handle_get_errors(params)
		"info.output":
			return _handle_get_output(params)
		"info.log_file":
			return _handle_get_log_file(params)
		"editor.select_node":
			return _handle_select_node(params)
		_:
			return {"error": {"code": -32601, "message": "Method not found: " + method}}


func _handle_initialize(_params: Dictionary) -> Dictionary:
	return {
		"result": {
			"server": "godot-ai-bridge",
			"godot_version": Engine.get_version_info().string,
			"project": ProjectSettings.get_setting("application/config/name"),
			"capabilities": ["scene_tree", "editor"]
		}
	}


func _handle_get_scene_tree(_params: Dictionary) -> Dictionary:
	var edited_scene = editor_interface.get_edited_scene_root()
	if not edited_scene:
		return {"result": {"nodes": [], "message": "No scene open"}}

	var nodes = _serialize_node_tree(edited_scene, "")
	return {
		"result": {
			"root": edited_scene.name,
			"scene_path": edited_scene.scene_file_path,
			"nodes": nodes
		}
	}


func _serialize_node_tree(node: Node, parent_path: String) -> Array:
	var nodes: Array = []
	var node_path = parent_path + "/" + node.name if parent_path else node.name

	var node_data = {
		"name": node.name,
		"type": node.get_class(),
		"path": node_path,
		"children_count": node.get_child_count()
	}

	if node.get_script():
		node_data["script"] = node.get_script().resource_path

	nodes.append(node_data)

	for child in node.get_children():
		nodes.append_array(_serialize_node_tree(child, node_path))

	return nodes


func _handle_add_node(params: Dictionary) -> Dictionary:
	var parent_path: String = params.get("parent", ".")
	var node_name: String = params.get("name", "")
	var node_type: String = params.get("type", "Node")

	if node_name.is_empty():
		return {"error": {"code": -32602, "message": "Missing name parameter"}}

	var edited_scene = editor_interface.get_edited_scene_root()
	if not edited_scene:
		return {"error": {"code": -32603, "message": "No scene open"}}

	var parent: Node
	if parent_path == "." or parent_path.is_empty():
		parent = edited_scene
	else:
		parent = edited_scene.get_node_or_null(parent_path)

	if not parent:
		return {"error": {"code": -32603, "message": "Parent not found: " + parent_path}}

	var new_node = ClassDB.instantiate(node_type)
	if not new_node:
		return {"error": {"code": -32603, "message": "Failed to create node: " + node_type}}

	new_node.name = node_name

	undo_redo.create_action("Add Node: " + node_name)
	undo_redo.add_do_method(parent, "add_child", new_node)
	undo_redo.add_do_property(new_node, "owner", edited_scene)
	undo_redo.add_do_reference(new_node)
	undo_redo.add_undo_method(parent, "remove_child", new_node)
	undo_redo.commit_action()

	return {"result": {"added": node_name, "path": str(new_node.get_path())}}


func _handle_remove_node(params: Dictionary) -> Dictionary:
	var path: String = params.get("path", "")
	if path.is_empty():
		return {"error": {"code": -32602, "message": "Missing path parameter"}}

	var edited_scene = editor_interface.get_edited_scene_root()
	if not edited_scene:
		return {"error": {"code": -32603, "message": "No scene open"}}

	var node = edited_scene.get_node_or_null(path)
	if not node:
		return {"error": {"code": -32603, "message": "Node not found: " + path}}

	if node == edited_scene:
		return {"error": {"code": -32603, "message": "Cannot remove scene root"}}

	var parent = node.get_parent()

	undo_redo.create_action("Remove Node: " + node.name)
	undo_redo.add_do_method(parent, "remove_child", node)
	undo_redo.add_undo_method(parent, "add_child", node)
	undo_redo.add_undo_property(node, "owner", edited_scene)
	undo_redo.add_undo_reference(node)
	undo_redo.commit_action()

	return {"result": {"removed": path}}


func _handle_modify_node(params: Dictionary) -> Dictionary:
	var path: String = params.get("path", "")
	var properties: Dictionary = params.get("properties", {})

	if path.is_empty():
		return {"error": {"code": -32602, "message": "Missing path parameter"}}

	var edited_scene = editor_interface.get_edited_scene_root()
	if not edited_scene:
		return {"error": {"code": -32603, "message": "No scene open"}}

	var node = edited_scene.get_node_or_null(path)
	if not node:
		return {"error": {"code": -32603, "message": "Node not found: " + path}}

	var modified: Array = []

	undo_redo.create_action("Modify Node: " + node.name)

	for prop_name in properties:
		if prop_name in node:
			var old_value = node.get(prop_name)
			var new_value = _convert_value(properties[prop_name])
			undo_redo.add_do_property(node, prop_name, new_value)
			undo_redo.add_undo_property(node, prop_name, old_value)
			modified.append(prop_name)

	undo_redo.commit_action()

	return {"result": {"modified": modified, "path": path}}


func _convert_value(value):
	if value is Dictionary:
		if value.get("_type") == "Vector2":
			return Vector2(value.get("x", 0), value.get("y", 0))
		elif value.get("_type") == "Vector3":
			return Vector3(value.get("x", 0), value.get("y", 0), value.get("z", 0))
		elif value.get("_type") == "Color":
			return Color(value.get("r", 1), value.get("g", 1), value.get("b", 1), value.get("a", 1))
	return value


func _handle_open_scene(params: Dictionary) -> Dictionary:
	var path: String = params.get("path", "")
	if path.is_empty():
		return {"error": {"code": -32602, "message": "Missing path parameter"}}

	editor_interface.open_scene_from_path(path)
	return {"result": {"opened": path}}


func _handle_save_scene(_params: Dictionary) -> Dictionary:
	editor_interface.save_scene()
	var edited_scene = editor_interface.get_edited_scene_root()
	var path = edited_scene.scene_file_path if edited_scene else ""
	return {"result": {"saved": true, "path": path}}


func _handle_run_scene(params: Dictionary) -> Dictionary:
	var path: String = params.get("path", "")
	if path.is_empty():
		editor_interface.play_current_scene()
	else:
		editor_interface.play_custom_scene(path)
	return {"result": {"running": true}}


func _handle_stop_scene(_params: Dictionary) -> Dictionary:
	editor_interface.stop_playing_scene()
	return {"result": {"stopped": true}}


func _handle_get_project_info(_params: Dictionary) -> Dictionary:
	return {
		"result": {
			"name": ProjectSettings.get_setting("application/config/name"),
			"path": ProjectSettings.globalize_path("res://"),
			"godot_version": Engine.get_version_info().string
		}
	}


func _handle_refresh_filesystem(_params: Dictionary) -> Dictionary:
	editor_interface.get_resource_filesystem().scan()
	return {"result": {"refreshed": true}}


func _success_response(id, result) -> String:
	return JSON.stringify({
		"jsonrpc": "2.0",
		"id": id,
		"result": result
	})


func _error_response(id, code: int, message: String) -> String:
	return JSON.stringify({
		"jsonrpc": "2.0",
		"id": id,
		"error": {
			"code": code,
			"message": message
		}
	})


func _handle_get_errors(params: Dictionary) -> Dictionary:
	var errors: Array = []
	var include_runtime: bool = params.get("include_runtime", true)
	var include_script: bool = params.get("include_script", true)
	var clear: bool = params.get("clear", false)

	# Add runtime errors from buffer
	if include_runtime:
		errors.append_array(error_buffer)

	# Get script editor to check for script errors
	if include_script:
		var script_editor = editor_interface.get_script_editor()
		if script_editor:
			var open_scripts = script_editor.get_open_scripts()
			for script in open_scripts:
				if script is GDScript:
					# Try to reload and check for errors
					var source = script.source_code
					var test_script = GDScript.new()
					test_script.source_code = source
					var err = test_script.reload(false)
					if err != OK:
						errors.append({
							"path": script.resource_path,
							"error": error_string(err),
							"type": "script_error"
						})

	# Clear error buffer if requested
	if clear:
		error_buffer.clear()

	return {"result": {"errors": errors, "count": errors.size(), "runtime_count": error_buffer.size()}}


func _handle_get_output(params: Dictionary) -> Dictionary:
	var lines: int = params.get("lines", 50)

	# Return recent output from our buffer
	var start_idx: int = max(0, output_buffer.size() - lines)
	var recent_output = output_buffer.slice(start_idx)

	return {
		"result": {
			"output": recent_output,
			"total_lines": output_buffer.size(),
			"returned_lines": recent_output.size()
		}
	}


func _handle_get_log_file(params: Dictionary) -> Dictionary:
	var lines: int = params.get("lines", 100)
	var filter: String = params.get("filter", "")  # Optional: "error", "warning", "all"

	# Get the user data path where Godot stores logs
	var user_path := OS.get_user_data_dir()
	var logs_dir := user_path + "/logs"

	# Find the most recent log file
	var dir := DirAccess.open(logs_dir)
	if not dir:
		return {"error": {"code": -32603, "message": "Cannot access logs directory: " + logs_dir}}

	var log_files: Array[String] = []
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while file_name != "":
		if file_name.ends_with(".log"):
			log_files.append(logs_dir + "/" + file_name)
		file_name = dir.get_next()
	dir.list_dir_end()

	if log_files.is_empty():
		return {"result": {"lines": [], "message": "No log files found"}}

	# Sort by modification time (most recent first)
	log_files.sort_custom(func(a: String, b: String) -> bool:
		return FileAccess.get_modified_time(a) > FileAccess.get_modified_time(b)
	)

	# Read the most recent log file
	var log_path: String = log_files[0]
	var file := FileAccess.open(log_path, FileAccess.READ)
	if not file:
		return {"error": {"code": -32603, "message": "Cannot read log file: " + log_path}}

	var content := file.get_as_text()
	file.close()

	# Split into lines and get the last N lines
	var all_lines := content.split("\n")
	var filtered_lines: Array[String] = []

	# Apply filter if specified
	for line in all_lines:
		if filter.is_empty() or filter == "all":
			filtered_lines.append(line)
		elif filter == "error" and (line.contains("ERROR") or line.contains("error")):
			filtered_lines.append(line)
		elif filter == "warning" and (line.contains("WARNING") or line.contains("warning")):
			filtered_lines.append(line)

	# Get last N lines
	var start_idx: int = max(0, filtered_lines.size() - lines)
	var recent_lines: Array[String] = []
	for i in range(start_idx, filtered_lines.size()):
		if not filtered_lines[i].is_empty():
			recent_lines.append(filtered_lines[i])

	return {
		"result": {
			"lines": recent_lines,
			"log_file": log_path,
			"total_lines": all_lines.size(),
			"returned_lines": recent_lines.size()
		}
	}


func _handle_select_node(params: Dictionary) -> Dictionary:
	var path: String = params.get("path", "")
	if path.is_empty():
		return {"error": {"code": -32602, "message": "Missing path parameter"}}

	var edited_scene = editor_interface.get_edited_scene_root()
	if not edited_scene:
		return {"error": {"code": -32603, "message": "No scene open"}}

	var node = edited_scene.get_node_or_null(path)
	if not node:
		return {"error": {"code": -32603, "message": "Node not found: " + path}}

	editor_interface.get_selection().clear()
	editor_interface.get_selection().add_node(node)

	return {"result": {"selected": path}}


func log_output(text: String) -> void:
	var timestamp = Time.get_time_string_from_system()
	var line = "[%s] %s" % [timestamp, text]
	output_buffer.append(line)

	# Keep buffer size limited
	while output_buffer.size() > MAX_OUTPUT_LINES:
		output_buffer.pop_front()


func log_error(error_data: Dictionary) -> void:
	var timestamp = Time.get_time_string_from_system()
	error_data["timestamp"] = timestamp
	error_buffer.append(error_data)

	# Keep buffer size limited
	while error_buffer.size() > MAX_ERROR_COUNT:
		error_buffer.pop_front()


func clear_errors() -> void:
	error_buffer.clear()


func clear_output() -> void:
	output_buffer.clear()
