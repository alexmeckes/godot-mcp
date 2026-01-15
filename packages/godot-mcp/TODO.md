# Godot MCP TODO

## Fixed

### `godot_editor_get_output` and `godot_editor_get_errors` - FIXED
- Added `info.output` and `info.errors` handlers to message_handler.gd
- Added EditorDebuggerPlugin to capture runtime output and errors from running games
- Output is stored in a ring buffer (500 lines max) and accessible via MCP
- Captures: game start/stop, debugger breaks, stack traces, runtime errors/warnings
- Added filtering for noisy messages (cursor_set_shape, etc.)

## Known Limitations

### Print statements not captured
- Regular `print()` statements from running games go to Godot's Output panel but are NOT captured through the debugger protocol
- The "output" message type in EditorDebuggerPlugin only captures debugger-specific output
- Workaround: Use `push_warning()` or `push_error()` for messages you want captured via MCP

### Script error false positives
- The script error checking creates temporary GDScript objects to test compilation
- This can report false positives when scripts have dependencies on autoloads or class_name references
- The game can still run correctly even when these errors are reported

## Future Improvements

### Enhanced error detection
- Currently checks open scripts for compilation errors
- Could add: filesystem scanning for all script errors, runtime exception tracking

### Better print() capture
- Could potentially hook into EditorLog or use a custom logging system
- Or parse the Output panel contents directly if API allows

### Script compile/reload warnings
- GDScript warnings (INTEGER_DIVISION, unused variables, etc.) shown in Debugger "Errors" tab are NOT sent through EditorDebuggerPlugin
- These are editor-level messages from the script compiler, not runtime debugger messages
- Possible approaches:
  - Research if Godot exposes EditorLog API
  - Custom script validation (parse scripts and detect issues ourselves)
  - File watching on Godot's internal log files
  - Hook into EditorScript or other editor APIs

### Plugin reload mechanism
- Add ability to trigger plugin reload via MCP for filter changes to take effect
