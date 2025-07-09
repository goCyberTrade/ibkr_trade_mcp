import os
import requests
from urllib3.exceptions import InsecureRequestWarning
from loguru import logger

# 禁用警告
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)


def send_ib_request(method: str, url: str, payload: dict | None = None, header: dict | None = None) -> dict:

    logger.info(f"准备发送请求地址:{method} {url}")
    logger.info(f"准备发送请求参数:{payload}")

    """
    发送HTTP请求的通用函数
    :param method: HTTP方法，如GET、POST、DELETE等
    :param url: 请求URL
    :param payload: 请求负载，默认为None
    :param header: 请求头，默认为None
    :return: JSON格式的响应数据，请求失败时返回空字典
    """
    if payload is None:
        payload = {}
    if header is None:
        header = {}

    try:
        # 根据HTTP方法调用对应的requests方法
        if method.upper() == 'GET':
            response = requests.get(url, params=payload, headers=header, verify=False)
        elif method.upper() == 'POST':
            response = requests.post(url, json=payload, headers=header, verify=False)
        elif method.upper() == 'DELETE':
            response = requests.delete(url, json=payload, headers=header, verify=False)
        else:
            raise ValueError(f"不支持的HTTP方法: {method}")

        base_url = os.getenv("IB_HOST")
        if response.status_code == 401 and base_url:
            raise ValueError(f"没有权限访问接口，请确认是否已经启动IB Gateway程序以及从{base_url} 登录(每次登录会话后认证有效期最多为24小时)")

        logger.info(f"准备发送请求响应:{response.json()}")
        return response.json()  # 返回JSON格式的响应

    except requests.RequestException as e:
        logger.error(f"{method.upper()} 请求 {url} 出错: {e}")
    except ValueError as e:
        raise e
    except Exception as e:
        logger.error(f"{method.upper()} 请求 {url} 发生未知错误: {e}")

    return {}


# 为常用HTTP方法创建便捷函数
def get(url: str, payload: dict | None = None, header: dict | None = None) -> dict:
    return send_ib_request('GET', url, payload, header)


def post(url: str, payload: dict | None = None, header: dict | None = None) -> dict:
    return send_ib_request('POST', url, payload, header)


def delete(url: str, payload: dict | None = None, header: dict | None = None) -> dict:
    return send_ib_request('DELETE', url, payload, header)