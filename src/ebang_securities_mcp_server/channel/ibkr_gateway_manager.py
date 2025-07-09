import os
import socket
import subprocess
import platform
import re
import tempfile
import requests
import zipfile
import platform
import shutil
import time
from loguru import logger

IB_HOST_KEY='IB_HOST'
IB_AUTO_RUN_KEY='IB_AUTO_RUN'
IB_GATEWAY_DOWNLOAD_DIR_KEY='IB_GATEWAY_DOWNLOAD_DIR'
IB_HOST=''
IB_START_SUCCESS = False
IB_START_FAIL_REASON = ''
IB_DEFAULT_HOST = 'https://localhost:5000'


def check_and_run_gateway():
    """
    1. 判断是否已配置IB Gateway，如果已配置，设置IB_HOST为IB Gateway的地址
    2. 判断是否配置自启动IB Gateway，如果未配置，结束流程
    3. 判断是否存在 Java 环境，如果不存在，结束流程
    4. 判断是否已下载IB Gateway，如果未下载，现下载，然后走启动IB Gateway流程
    5. 启动 ibgateway
    6. 判断是否启动成功，如果启动成功，设置IB_HOST为IB Gateway的地址                                         
    """
    global IB_START_SUCCESS, IB_START_FAIL_REASON, IB_HOST

    IB_HOST = os.getenv(IB_HOST_KEY, '')
    auto_run = os.getenv(IB_AUTO_RUN_KEY, '')
    print(f"print IB_HOST:{IB_HOST} IB_AUTO_RUN_KEY:{auto_run}")
    print(f"print auto_run type {type(auto_run)}")
    print(f"not IB_HOST {not IB_HOST}")
    print(f"auto_run != 'True' {auto_run != 'True'}")
    if not IB_HOST and auto_run != 'True':
        print(f"if not IB_HOST and auto_run != 'True'")
        IB_START_FAIL_REASON = 'set evnironment variable IB_HOST or IB_AUTO_RUN to True'
        return False
    if IB_HOST:
        print(f"if IB_HOST:")
        IB_START_SUCCESS = True
        return True

    IB_HOST = IB_DEFAULT_HOST
    os.environ["IB_HOST"] = IB_HOST

    if is_process_running():
        print(f"if is_process_running():")
        print(f'ib gateway already running:{IB_HOST}')
        IB_START_SUCCESS = True
        return True
    success, reason = check_jdk()
    if not success:
        print(f"if check_jdk not success:")
        IB_START_FAIL_REASON = reason
        return False
    try:

        gateway_path = download_ib_gateway()
        if not gateway_path:
            IB_START_FAIL_REASON = 'download ib gateway failed'
            return False
        if not start_ib_gateway(gateway_path):
            IB_START_FAIL_REASON = 'start ib gateway failed'
            return False

        print(f'ib gateway started:{IB_HOST}')
        IB_START_SUCCESS = True    
        return True 
    except Exception as e:
        print(f'start ib gateway failed:{str(e)}')
        IB_START_FAIL_REASON = 'start ib gateway failed, try again later'
        return False

def download_ib_gateway():
    """下载IB Gateway 并解压，返回解压后的路径"""
    down_load_url='https://download2.interactivebrokers.com/portal/clientportal.gw.zip'
    down_load_dir = os.getenv(IB_GATEWAY_DOWNLOAD_DIR_KEY, '')
    if not down_load_dir:
        down_load_dir = tempfile.gettempdir()
    os.makedirs(down_load_dir, exist_ok=True)
    target_file_dir = os.path.join(down_load_dir, 'clientportal.gw')


    if os.path.exists(target_file_dir):
        print('ib gateway(clientportal.gw) already exists, delete dir')
        delete_file(target_file_dir)

    target_zip_file = os.path.join(down_load_dir, 'clientportal.gw.zip')
    if os.path.exists(target_zip_file):
        print('ib gateway(clientportal.gw.zip) already exists, skip download')
    else:
        print('downloading ib gateway(clientportal.gw.zip)')
        start_time = time.time()
        response = requests.get(down_load_url, timeout=20)
        if response.status_code == 200:
            with open(target_zip_file, 'wb') as file:
                file.write(response.content)
            end_time = time.time()
            duration = end_time - start_time
            print(f'download ib gateway(clientportal.gw.zip) success, cost {duration:.1f} second:{down_load_dir}')
        else:
            print('download ib gateway(clientportal.gw.zip) failed')
            return None
    #解压文件，并 catch 异常，如果解压失败，删除文件
    try:
        print('unzip ib gateway(clientportal.gw.zip)')
        with zipfile.ZipFile(target_zip_file, 'r') as zip_ref:
            zip_ref.extractall(path=target_file_dir)
        print(f'unzip ib gateway(clientportal.gw.zip) success:{target_file_dir}')
        return target_file_dir
    except Exception as e:
        print('unzip ib gateway(clientportal.gw.zip) failed')
        delete_file(target_file_dir)
        delete_file(target_zip_file)
        return None

def delete_file(file_path:str):
    """
    删除文件或者目录
    
    参数:
        file_path: 文件路径
    """
    try:
        print(f'delete file:{file_path}')
        # 检查文件是否存在
        if os.path.exists(file_path):
            # 检查是否为目录
            if os.path.isdir(file_path):
                shutil.rmtree(file_path)
            else:
                os.remove(file_path)
        else:
            print(f"File not exist: {file_path}")
    except Exception as e:
        print(f"delete file error: {e}")
    
def start_ib_gateway(gateway_path:str):
    """
    1. 判断系统类型，如果是Windows，执行run.bat
    2. 如果是Linux，执行run.sh
    3. 如果是Mac，执行run.sh
    """
    # 保存当前目录，以便之后切回
    original_dir = os.getcwd()
    #只能从根目录启动
    config_path = os.path.join('root', 'conf.yaml')
    system_type = platform.system() 
    if system_type == 'Windows':
        start_file = os.path.join('bin', 'run.bat')
    else:
        start_file = os.path.join('bin', 'run.sh')
    try:
       
        # 切换到根目录
        os.chdir(gateway_path)

        os.chmod(start_file, 0o755)

        # 执行脚本并打印子进程标准输出
        print(f'starting ib gateway:{gateway_path}')
        process = subprocess.Popen(
            [start_file, config_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        # wait process start
        time.sleep(5)

        return True
    except Exception as e:
        print(f'start ib gateway failed:{str(e)}')
        return False
    finally:
        # 切回原始目录
        os.chdir(original_dir)

def check_jdk():
    """检查系统中是否安装了 Java 环境"""
    try:
        # 尝试执行 java -version 命令
        result = subprocess.run(
            ["java", "-version"], 
            capture_output=True, 
            text=True, 
            check=False
        )
        
        # 对于 java -version 命令，其输出通常在 stderr 中
        if result.returncode == 0:
            java_version_output = result.stderr if result.stderr else result.stdout
            # 使用正则表达式提取 Java 版本信息
            version_match = re.search(r'java version "([\d._]+)"', java_version_output)
            if not version_match:
                version_match = re.search(r'openjdk version "([\d._]+)"', java_version_output)
            
            if version_match:
                java_version = version_match.group(1)
                return True, f"Java version: {java_version}"
            else:
                return True, "Java has been installed, but version information could not be determined"
        else:
            return False, "Java uninstalled or not in system path"
    except Exception as e:
        return False, "Java uninstalled or not in system path"

def is_process_running(port=5000):
    """
    通过尝试监听端口来检查端口是否可用
    参数:
        port: 端口号
    """
    # 创建一个 socket 对象
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    
    try:
        # 尝试绑定到指定的主机和端口
        s.bind(('localhost', port))
        return False
    except OSError as e:
        # 如果绑定失败，端口已被占用
        print(f"port {port} has been used, reuse it")
        return True
    finally:
        # 关闭 socket 连接
        s.close()

# 示例使用
if __name__ == "__main__":
    try:
        success = check_and_run_gateway()
        if success:
            print(f"脚本执行成功:{IB_HOST}")
        else:
            print(f"脚本执行失败:{IB_START_FAIL_REASON}")
    except Exception as e:
        print(f"执行过程中出错: {str(e)}")