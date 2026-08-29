import os
import sys
import subprocess
import platform

def get_venv_bin():
    """Returns the path to the virtual env's bin or Scripts directory."""
    if platform.system() == "Windows":
        return os.path.join(".venv", "Scripts")
    return os.path.join(".venv", "bin")

def main():
    print("=== Terravision Preprocessing Microservice Setup ===")
    
    # 1. Create virtual environment if it doesn't exist
    if not os.path.exists(".venv"):
        print("Creating virtual environment '.venv'...")
        subprocess.check_call([sys.executable, "-m", "venv", ".venv"])
    else:
        print("Virtual environment '.venv' already exists.")
        
    venv_bin = get_venv_bin()
    python_exe = os.path.join(venv_bin, "python")
    pip_exe = os.path.join(venv_bin, "pip")
    
    # Check if executable exists (e.g. extension on Windows is .exe)
    if platform.system() == "Windows":
        python_exe += ".exe"
        pip_exe += ".exe"
        
    # 2. Upgrade pip
    print("Upgrading pip...")
    subprocess.check_call([python_exe, "-m", "pip", "install", "--upgrade", "pip"])
    
    # 3. Install requirements
    print("Installing requirements from requirements.txt...")
    subprocess.check_call([pip_exe, "install", "-r", "requirements.txt"])
    
    print("\nStarting Preprocessing FastAPI Server on port 8000...")
    
    # 4. Start Uvicorn
    # Use uvicorn module from within the virtualenv python execution to avoid PATH issues
    subprocess.check_call([
        python_exe, 
        "-m", 
        "uvicorn", 
        "main:app", 
        "--host", "127.0.0.1", 
        "--port", "8000",
        "--reload"
    ])

if __name__ == "__main__":
    main()
