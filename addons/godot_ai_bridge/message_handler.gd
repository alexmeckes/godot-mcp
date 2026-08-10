@tool
extends RefCounted
## Handles JSON-RPC messages for AI Bridge

var editor_interface: EditorInterface
var undo_redo: EditorUndoRedoManager
var debugger_plugin: Object
var output_buffer: Array[Dictionary] = []
var error_buffer: Array[Dictionary] = []
const MAX_OUTPUT_LINES: int = 500
const MAX_ERROR_COUNT: int = 100
const LOG_LEVELS := ["debug", "info", "warning", "error"]


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

	var result = await _dispatch(method, params)

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
		"runtime.status":
			return await _handle_runtime_status(params)
		"runtime.wait":
			return await _handle_runtime_wait(params)
		"runtime.press_action":
			return await _handle_runtime_press_action(params)
		"runtime.release_action":
			return await _handle_runtime_release_action(params)
		"runtime.tap_action":
			return await _handle_runtime_tap_action(params)
		"runtime.mouse_move":
			return await _handle_runtime_mouse_move(params)
		"runtime.click":
			return await _handle_runtime_click(params)
		"runtime.type_text":
			return await _handle_runtime_type_text(params)
		"runtime.capture_screenshot":
			return await _handle_runtime_capture_screenshot(params)
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
		"execute.gdscript":
			return _handle_execute_gdscript(params)
		_:
			return {"error": {"code": -32601, "message": "Method not found: " + method}}


func _handle_initialize(_params: Dictionary) -> Dictionary:
	return {
		"result": {
			"server": "godot-ai-bridge",
			"godot_version": Engine.get_version_info().string,
			"project": ProjectSettings.get_setting("application/config/name"),
			"capabilities": ["scene_tree", "editor", "runtime"]
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
	var properties: Dictionary = params.get("properties", {})

	if node_name.is_empty():
		return {"error": {"code": -32602, "message": "Missing name parameter"}}

	var edited_scene = editor_interface.get_edited_scene_root()
	if not edited_scene:
		return {"error": {"code": -32603, "message": "No scene open"}}

	var parent = _resolve_scene_node(parent_path, edited_scene)

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

	var applied_properties: Array = []
	for prop_name in properties:
		if prop_name in new_node:
			var old_value = new_node.get(prop_name)
			var new_value = _convert_value(properties[prop_name])
			undo_redo.add_do_property(new_node, prop_name, new_value)
			undo_redo.add_undo_property(new_node, prop_name, old_value)
			applied_properties.append(prop_name)

	undo_redo.commit_action()

	return {
		"result": {
			"added": node_name,
			"path": _scene_tree_path_for(new_node, edited_scene),
			"applied_properties": applied_properties
		}
	}


func _handle_remove_node(params: Dictionary) -> Dictionary:
	var path: String = params.get("path", "")
	if path.is_empty():
		return {"error": {"code": -32602, "message": "Missing path parameter"}}

	var edited_scene = editor_interface.get_edited_scene_root()
	if not edited_scene:
		return {"error": {"code": -32603, "message": "No scene open"}}

	var node = _resolve_scene_node(path, edited_scene)
	if not node:
		return {"error": {"code": -32603, "message": "Node not found: " + path}}

	if node == edited_scene:
		return {"error": {"code": -32603, "message": "Cannot remove scene root"}}

	var parent = node.get_parent()
	var scene_path := _scene_tree_path_for(node, edited_scene)

	undo_redo.create_action("Remove Node: " + node.name)
	undo_redo.add_do_method(parent, "remove_child", node)
	undo_redo.add_undo_method(parent, "add_child", node)
	undo_redo.add_undo_property(node, "owner", edited_scene)
	undo_redo.add_undo_reference(node)
	undo_redo.commit_action()

	return {"result": {"removed": scene_path}}


func _handle_modify_node(params: Dictionary) -> Dictionary:
	var path: String = params.get("path", "")
	var properties: Dictionary = params.get("properties", {})

	if path.is_empty():
		return {"error": {"code": -32602, "message": "Missing path parameter"}}

	var edited_scene = editor_interface.get_edited_scene_root()
	if not edited_scene:
		return {"error": {"code": -32603, "message": "No scene open"}}

	var node = _resolve_scene_node(path, edited_scene)
	if not node:
		return {"error": {"code": -32603, "message": "Node not found: " + path}}

	var modified: Array = []
	var scene_path := _scene_tree_path_for(node, edited_scene)

	undo_redo.create_action("Modify Node: " + node.name)

	for prop_name in properties:
		if prop_name in node:
			var old_value = node.get(prop_name)
			var new_value = _convert_value(properties[prop_name])
			undo_redo.add_do_property(node, prop_name, new_value)
			undo_redo.add_undo_property(node, prop_name, old_value)
			modified.append(prop_name)

	undo_redo.commit_action()

	return {"result": {"modified": modified, "path": scene_path}}


func _convert_value(value):
	if value is Dictionary:
		var dict: Dictionary = value

		match str(dict.get("_type", "")):
			"Vector2":
				return Vector2(dict.get("x", 0), dict.get("y", 0))
			"Vector3":
				return Vector3(dict.get("x", 0), dict.get("y", 0), dict.get("z", 0))
			"Color":
				return Color(dict.get("r", 1), dict.get("g", 1), dict.get("b", 1), dict.get("a", 1))

		if dict.has("x") and dict.has("y"):
			if dict.has("z"):
				return Vector3(dict.get("x", 0), dict.get("y", 0), dict.get("z", 0))
			return Vector2(dict.get("x", 0), dict.get("y", 0))

		if dict.has("r") and dict.has("g") and dict.has("b"):
			return Color(dict.get("r", 1), dict.get("g", 1), dict.get("b", 1), dict.get("a", 1))

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


func _handle_runtime_status(_params: Dictionary) -> Dictionary:
	return await _send_runtime_request("status", {})


func _handle_runtime_wait(params: Dictionary) -> Dictionary:
	var request_params: Dictionary = {}
	if params.has("frames"):
		request_params["frames"] = int(params.get("frames", 0))
	if params.has("seconds"):
		request_params["seconds"] = float(params.get("seconds", 0.0))
	return await _send_runtime_request("wait", request_params)


func _handle_runtime_press_action(params: Dictionary) -> Dictionary:
	return await _send_runtime_request("press_action", {
		"action": str(params.get("action", "")),
		"strength": float(params.get("strength", 1.0))
	})


func _handle_runtime_release_action(params: Dictionary) -> Dictionary:
	return await _send_runtime_request("release_action", {
		"action": str(params.get("action", ""))
	})


func _handle_runtime_tap_action(params: Dictionary) -> Dictionary:
	return await _send_runtime_request("tap_action", {
		"action": str(params.get("action", "")),
		"frames": int(params.get("frames", 1)),
		"strength": float(params.get("strength", 1.0))
	})


func _handle_runtime_mouse_move(params: Dictionary) -> Dictionary:
	return await _send_runtime_request("mouse_move", {
		"x": float(params.get("x", 0.0)),
		"y": float(params.get("y", 0.0))
	})


func _handle_runtime_click(params: Dictionary) -> Dictionary:
	var request_params: Dictionary = {
		"button": int(params.get("button", MOUSE_BUTTON_LEFT)),
		"holdFrames": int(params.get("holdFrames", 1))
	}
	if params.has("x"):
		request_params["x"] = float(params.get("x", 0.0))
	if params.has("y"):
		request_params["y"] = float(params.get("y", 0.0))
	return await _send_runtime_request("click", request_params)


func _handle_runtime_type_text(params: Dictionary) -> Dictionary:
	return await _send_runtime_request("type_text", {
		"text": str(params.get("text", ""))
	})


func _handle_runtime_capture_screenshot(params: Dictionary) -> Dictionary:
	return await _send_runtime_request("capture_screenshot", {
		"path": str(params.get("path", ""))
	})


func _send_runtime_request(method: String, params: Dictionary) -> Dictionary:
	if debugger_plugin == null:
		return {
			"error": {
				"code": -32603,
				"message": "Runtime automation bridge is unavailable."
			}
		}

	if not debugger_plugin.has_method("send_runtime_request"):
		return {
			"error": {
				"code": -32603,
				"message": "Runtime automation transport is not installed in this AI Bridge build."
			}
		}

	var response = await debugger_plugin.send_runtime_request(method, params)
	if response is Dictionary:
		return response

	return {
		"error": {
			"code": -32603,
			"message": "Runtime automation returned an unexpected response for %s." % method
		}
	}


func _handle_execute_gdscript(params: Dictionary) -> Dictionary:
	var code: String = params.get("code", "")
	if code.is_empty():
		return {"error": {"code": -32602, "message": "Missing code parameter"}}

	var log_checkpoint: int = _get_log_checkpoint_line()
	var script_source := "extends RefCounted\nfunc __mcp_exec(editor_interface: Variant, message_handler: Variant) -> Variant:\n"
	script_source += _indent_code(code)

	var temp_script := GDScript.new()
	temp_script.source_code = script_source
	var err := temp_script.reload()
	if err != OK:
		var script_identifier: String = str(temp_script.resource_path)
		var diagnostics: Array[String] = _collect_recent_script_diagnostics(
			script_identifier,
			log_checkpoint,
			8
		)
		var error_message := "Failed to compile script: " + error_string(err)
		if not diagnostics.is_empty():
			error_message += "\n" + "\n".join(diagnostics)
		log_error({
			"type": "script_error",
			"level": "error",
			"source": "execute.gdscript",
			"message": error_message,
			"error": error_string(err),
			"script_path": script_identifier
		})
		return {
			"error": {
				"code": -32603,
				"message": error_message
			}
		}

	var runner: Object = temp_script.new()
	if runner == null:
		var instantiate_error_message := "Failed to instantiate compiled script"
		log_error({
			"type": "script_error",
			"level": "error",
			"source": "execute.gdscript",
			"message": instantiate_error_message,
			"error": instantiate_error_message
		})
		return {
			"error": {
				"code": -32603,
				"message": instantiate_error_message
			}
		}

	if not runner.has_method("__mcp_exec"):
		var missing_method_message := "Compiled script is missing __mcp_exec entrypoint"
		log_error({
			"type": "script_error",
			"level": "error",
			"source": "execute.gdscript",
			"message": missing_method_message,
			"error": missing_method_message
		})
		return {
			"error": {
				"code": -32603,
				"message": missing_method_message
			}
		}

	var result = runner.call("__mcp_exec", editor_interface, self)

	return {"result": {"executed": true, "result": result}}


func _get_log_checkpoint_line() -> int:
	var scan_result = _scan_recent_log_entries(1, "all", "")
	if scan_result.has("error"):
		return 0
	return int(scan_result.get("next_since_line", 0))


func _collect_recent_script_diagnostics(
	script_identifier: String,
	since_line: int = 0,
	max_entries: int = 8
) -> Array[String]:
	var scan_result = _scan_recent_log_entries(300, "error", "", since_line)
	if scan_result.has("error"):
		var empty: Array[String] = []
		return empty

	var entries: Array = scan_result.get("entries", [])
	var targeted: Array[String] = []
	var fallback: Array[String] = []

	for item in entries:
		if not item is Dictionary:
			continue
		var entry: Dictionary = item
		var entry_text := str(entry.get("text", "")).strip_edges()
		if entry_text.is_empty():
			continue

		var has_script_ref := entry_text.contains("gdscript://")
		var has_parse_signal := (
			entry_text.contains("Parse Error")
			or entry_text.contains("Parser Error")
			or entry_text.contains("Warning treated as error")
			or entry_text.contains("static type")
		)
		if not has_script_ref and not has_parse_signal:
			continue

		if not script_identifier.is_empty() and entry_text.contains(script_identifier):
			targeted.append(entry_text)
		elif has_script_ref and has_parse_signal:
			fallback.append(entry_text)

	var selected: Array[String] = targeted if not targeted.is_empty() else fallback
	var deduped: Array[String] = []
	var seen := {}
	for line in selected:
		if seen.has(line):
			continue
		seen[line] = true
		deduped.append(line)

	return _take_last_string_entries(deduped, max_entries)


func _take_last_string_entries(entries: Array[String], max_count: int) -> Array[String]:
	if max_count <= 0:
		var empty: Array[String] = []
		return empty
	var start_idx: int = max(0, entries.size() - max_count)
	var recent: Array[String] = []
	for i in range(start_idx, entries.size()):
		recent.append(entries[i])
	return recent


func _indent_code(code: String) -> String:
	var lines := code.split("\n")
	var indented: PackedStringArray = []
	for line in lines:
		indented.append("\t" + line)
	return "\n".join(indented) + "\n"


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
	var include_log_file: bool = params.get("include_log_file", true)
	var severity: String = _normalize_log_level(str(params.get("severity", "all")))
	var query: String = str(params.get("query", "")).strip_edges()
	var log_lines: int = int(params.get("log_lines", 200))
	var clear: bool = params.get("clear", false)
	var source_counts := {"runtime": 0, "script": 0, "log_file": 0}

	# Add runtime errors from buffer
	if include_runtime:
		for runtime_error in error_buffer:
			if _error_matches(runtime_error, severity, query):
				errors.append(runtime_error)
				source_counts["runtime"] = int(source_counts["runtime"]) + 1

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
						var script_error := {
							"path": script.resource_path,
							"file": script.resource_path,
							"error": error_string(err),
							"message": error_string(err),
							"type": "script_error",
							"level": "error",
							"source": "script_editor"
						}
						if _error_matches(script_error, severity, query):
							errors.append(script_error)
							source_counts["script"] = int(source_counts["script"]) + 1

	if include_log_file:
		var log_scan = _scan_recent_log_entries(log_lines, severity, query)
		if not log_scan.has("error"):
			var log_entries: Array = log_scan.get("entries", [])
			for log_entry in log_entries:
				if not log_entry is Dictionary:
					continue
				var level: String = str(log_entry.get("level", "info"))
				if level != "error" and level != "warning":
					continue
				var mapped_error := {
					"type": level,
					"level": level,
					"source": "log_file",
					"log_file": log_scan.get("log_file", ""),
					"line_number": log_entry.get("line_number", 0),
					"timestamp": log_entry.get("timestamp", ""),
					"message": log_entry.get("text", ""),
				}
				if _error_matches(mapped_error, severity, query):
					errors.append(mapped_error)
					source_counts["log_file"] = int(source_counts["log_file"]) + 1

	errors = _dedupe_error_entries(errors)

	# Clear error buffer if requested
	if clear:
		error_buffer.clear()

	return {
		"result": {
			"errors": errors,
			"count": errors.size(),
			"runtime_count": error_buffer.size(),
			"source_counts": source_counts,
			"filters": {
				"severity": severity,
				"query": query,
				"include_runtime": include_runtime,
				"include_script": include_script,
				"include_log_file": include_log_file
			}
		}
	}


func _handle_get_output(params: Dictionary) -> Dictionary:
	var lines: int = params.get("lines", 50)
	var level: String = _normalize_log_level(str(params.get("level", "all")))
	var source: String = str(params.get("source", "all")).to_lower()
	var query: String = str(params.get("query", "")).strip_edges()
	var clear: bool = params.get("clear", false)
	var include_metadata: bool = params.get("include_metadata", true)
	var filtered_output: Array[Dictionary] = []

	for entry in output_buffer:
		if _output_entry_matches(entry, level, source, query):
			filtered_output.append(entry)

	var recent_output: Array[Dictionary] = _take_last_entries(filtered_output, lines)
	var output_lines: Array[String] = []
	for entry in recent_output:
		output_lines.append(str(entry.get("line", entry.get("message", ""))))

	if clear:
		output_buffer.clear()

	return {
		"result": {
			"output": output_lines,
			"entries": recent_output if include_metadata else [],
			"total_lines": output_buffer.size(),
			"matched_lines": filtered_output.size(),
			"returned_lines": output_lines.size(),
			"filters": {
				"level": level,
				"source": source,
				"query": query
			}
		}
	}


func _handle_get_log_file(params: Dictionary) -> Dictionary:
	var lines: int = params.get("lines", 100)
	var filter: String = _normalize_log_level(str(params.get("filter", "all")))
	var query: String = str(params.get("query", "")).strip_edges()
	var since_line: int = int(params.get("since_line", 0))
	var include_metadata: bool = params.get("include_metadata", true)
	var scan_result = _scan_recent_log_entries(lines, filter, query, since_line)

	if scan_result.has("error"):
		return {"error": {"code": -32603, "message": str(scan_result.get("error", "Unknown log read error"))}}

	var entries: Array = scan_result.get("entries", [])
	var line_text: Array[String] = []
	for entry in entries:
		if entry is Dictionary:
			line_text.append(str(entry.get("text", "")))

	return {
		"result": {
			"lines": line_text,
			"entries": entries if include_metadata else [],
			"log_file": scan_result.get("log_file", ""),
			"total_lines": scan_result.get("total_lines", 0),
			"matched_lines": scan_result.get("matched_lines", 0),
			"returned_lines": line_text.size(),
			"next_since_line": scan_result.get("next_since_line", 0),
			"level_counts": scan_result.get("level_counts", {}),
			"filters": {
				"filter": filter,
				"query": query,
				"since_line": since_line
			}
		}
	}


func _handle_select_node(params: Dictionary) -> Dictionary:
	var path: String = params.get("path", "")
	if path.is_empty():
		return {"error": {"code": -32602, "message": "Missing path parameter"}}

	var edited_scene = editor_interface.get_edited_scene_root()
	if not edited_scene:
		return {"error": {"code": -32603, "message": "No scene open"}}

	var node = _resolve_scene_node(path, edited_scene)
	if not node:
		return {"error": {"code": -32603, "message": "Node not found: " + path}}

	editor_interface.get_selection().clear()
	editor_interface.get_selection().add_node(node)

	return {"result": {"selected": _scene_tree_path_for(node, edited_scene)}}


func _resolve_scene_node(path: String, edited_scene: Node) -> Node:
	if not edited_scene:
		return null

	var normalized_path := path.strip_edges()
	if normalized_path.is_empty() or normalized_path == ".":
		return edited_scene

	if normalized_path == edited_scene.name:
		return edited_scene

	var direct = edited_scene.get_node_or_null(normalized_path)
	if direct:
		return direct

	var root_prefix := edited_scene.name + "/"
	if normalized_path.begins_with(root_prefix):
		var relative_path := normalized_path.substr(root_prefix.length())
		if relative_path.is_empty():
			return edited_scene
		return edited_scene.get_node_or_null(relative_path)

	return null


func _scene_tree_path_for(node: Node, edited_scene: Node) -> String:
	if not node or not edited_scene:
		return ""

	if node == edited_scene:
		return edited_scene.name

	var relative_path := str(edited_scene.get_path_to(node))
	if relative_path.is_empty() or relative_path == ".":
		return edited_scene.name

	return edited_scene.name + "/" + relative_path


func log_output(text: String, level: String = "info", source: String = "runtime") -> void:
	var message: String = text.strip_edges()
	if message.is_empty():
		return

	var timestamp = Time.get_datetime_string_from_system()
	var normalized_level: String = _normalize_log_level(level)
	if normalized_level == "all":
		normalized_level = _classify_log_level(message)
	var line = "[%s] %s" % [timestamp, message]
	output_buffer.append({
		"timestamp": timestamp,
		"level": normalized_level,
		"source": source,
		"message": message,
		"line": line
	})

	# Keep buffer size limited
	while output_buffer.size() > MAX_OUTPUT_LINES:
		output_buffer.pop_front()


func log_error(error_data: Dictionary) -> void:
	var entry := error_data.duplicate(true)
	var timestamp = Time.get_datetime_string_from_system()
	if not entry.has("timestamp"):
		entry["timestamp"] = timestamp
	var level: String = _normalize_log_level(str(entry.get("level", entry.get("type", "error"))))
	if level == "all":
		level = _classify_log_level(str(entry.get("message", "")))
	entry["level"] = level
	if not entry.has("type"):
		entry["type"] = level
	if not entry.has("source"):
		entry["source"] = "runtime"
	error_buffer.append(entry)

	# Keep buffer size limited
	while error_buffer.size() > MAX_ERROR_COUNT:
		error_buffer.pop_front()


func clear_errors() -> void:
	error_buffer.clear()


func clear_output() -> void:
	output_buffer.clear()


func _normalize_log_level(level: String) -> String:
	var normalized := level.to_lower().strip_edges()
	if normalized.is_empty() or normalized == "all":
		return "all"
	if LOG_LEVELS.has(normalized):
		return normalized
	return "all"


func _classify_log_level(text: String) -> String:
	var lower := text.to_lower()
	if (
		lower.contains("error")
		or lower.contains("exception")
		or lower.contains("failed")
		or lower.contains("fatal")
	):
		return "error"
	if lower.contains("warning") or lower.contains("warn"):
		return "warning"
	if lower.contains("debug") or lower.contains("[msg:") or lower.contains("[stack]"):
		return "debug"
	return "info"


func _line_matches_filter(line: String, line_level: String, filter_level: String, query: String) -> bool:
	if filter_level != "all" and line_level != filter_level:
		return false
	if not query.is_empty() and not line.to_lower().contains(query.to_lower()):
		return false
	return true


func _extract_timestamp_from_line(line: String) -> String:
	var regex := RegEx.new()
	var compile_err = regex.compile("^\\[([^\\]]+)\\]")
	if compile_err != OK:
		return ""
	var match = regex.search(line)
	if match:
		return match.get_string(1)
	return ""


func _resolve_latest_log_file_path() -> Dictionary:
	var user_path := OS.get_user_data_dir()
	var logs_dir := user_path + "/logs"
	var dir := DirAccess.open(logs_dir)
	if not dir:
		return {"error": "Cannot access logs directory: " + logs_dir}

	var log_files: Array[String] = []
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while file_name != "":
		if file_name.ends_with(".log"):
			log_files.append(logs_dir + "/" + file_name)
		file_name = dir.get_next()
	dir.list_dir_end()

	if log_files.is_empty():
		return {"error": "No log files found"}

	log_files.sort_custom(func(a: String, b: String) -> bool:
		return FileAccess.get_modified_time(a) > FileAccess.get_modified_time(b)
	)

	return {"path": log_files[0]}


func _scan_recent_log_entries(
	lines: int,
	filter_level: String,
	query: String,
	since_line: int = 0
) -> Dictionary:
	var log_info = _resolve_latest_log_file_path()
	if log_info.has("error"):
		return {"error": log_info["error"]}

	var log_path: String = str(log_info.get("path", ""))
	var file := FileAccess.open(log_path, FileAccess.READ)
	if not file:
		return {"error": "Cannot read log file: " + log_path}

	var content := file.get_as_text()
	file.close()

	var all_lines := content.replace("\r", "").split("\n")
	var matched_entries: Array[Dictionary] = []
	var level_counts := {"debug": 0, "info": 0, "warning": 0, "error": 0}
	var normalized_filter: String = _normalize_log_level(filter_level)

	for i in range(all_lines.size()):
		var line_number: int = i + 1
		if since_line > 0 and line_number <= since_line:
			continue

		var raw_line: String = all_lines[i].strip_edges()
		if raw_line.is_empty():
			continue

		var level := _classify_log_level(raw_line)
		if not _line_matches_filter(raw_line, level, normalized_filter, query):
			continue

		level_counts[level] = int(level_counts.get(level, 0)) + 1
		matched_entries.append({
			"line_number": line_number,
			"level": level,
			"text": raw_line,
			"timestamp": _extract_timestamp_from_line(raw_line),
		})

	var recent_entries: Array[Dictionary] = _take_last_entries(matched_entries, lines)

	return {
		"log_file": log_path,
		"entries": recent_entries,
		"total_lines": all_lines.size(),
		"matched_lines": matched_entries.size(),
		"next_since_line": all_lines.size(),
		"level_counts": level_counts,
	}


func _take_last_entries(entries: Array[Dictionary], max_count: int) -> Array[Dictionary]:
	if max_count <= 0:
		var empty: Array[Dictionary] = []
		return empty
	var start_idx: int = max(0, entries.size() - max_count)
	var recent: Array[Dictionary] = []
	for i in range(start_idx, entries.size()):
		recent.append(entries[i])
	return recent


func _output_entry_matches(
	entry: Dictionary,
	level: String,
	source: String,
	query: String
) -> bool:
	var entry_level: String = _normalize_log_level(str(entry.get("level", "info")))
	if level != "all" and entry_level != level:
		return false

	var entry_source: String = str(entry.get("source", "runtime")).to_lower()
	if source != "all" and source != entry_source:
		return false

	if not query.is_empty():
		var haystack := (
			str(entry.get("message", ""))
			+ " "
			+ str(entry.get("line", ""))
		).to_lower()
		if not haystack.contains(query.to_lower()):
			return false

	return true


func _error_matches(entry: Dictionary, severity: String, query: String) -> bool:
	var level: String = _normalize_log_level(str(entry.get("level", entry.get("type", "error"))))
	if level == "all":
		level = _classify_log_level(str(entry.get("message", entry.get("error", ""))))

	if severity != "all":
		if level != severity:
			return false

	if not query.is_empty():
		var haystack := (
			str(entry.get("message", entry.get("error", "")))
			+ " "
			+ str(entry.get("file", entry.get("path", "")))
			+ " "
			+ str(entry.get("function", ""))
			+ " "
			+ str(entry.get("source", ""))
		).to_lower()
		if not haystack.contains(query.to_lower()):
			return false

	return true


func _dedupe_error_entries(errors: Array) -> Array:
	var deduped: Array = []
	var seen := {}

	for item in errors:
		if not item is Dictionary:
			continue
		var entry: Dictionary = item
		var key := "%s|%s|%s|%s|%s|%s" % [
			str(entry.get("source", "")),
			str(entry.get("file", entry.get("path", ""))),
			str(entry.get("line", entry.get("line_number", ""))),
			str(entry.get("function", "")),
			str(entry.get("type", entry.get("level", ""))),
			str(entry.get("message", entry.get("error", ""))),
		]
		if seen.has(key):
			continue
		seen[key] = true
		deduped.append(entry)

	return deduped
