"""
SoilScan GUI Launcher
Double-click this file to launch the SoilScan application.
"""
import sys
import subprocess
from pathlib import Path

# Get the directory of this script
script_dir = Path(__file__).parent

# Check if virtual environment exists
venv_python = script_dir / "venv" / "Scripts" / "pythonw.exe"
if not venv_python.exists():
    venv_python = script_dir / "venv" / "Scripts" / "python.exe"

# If venv exists, use it; otherwise use system Python
if venv_python.exists():
    python_exe = str(venv_python)
else:
    python_exe = sys.executable

# Run the GUI
gui_script = script_dir / "soilscan_gui.py"
subprocess.Popen([python_exe, str(gui_script)], cwd=str(script_dir))
