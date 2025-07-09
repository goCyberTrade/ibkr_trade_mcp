import os

from ebang_securities_mcp_server.utils.common_request import get, post

IB_HOST = os.getenv("IB_HOST", "https://localhost:5000/v1/api")


class IBKRChannel:
    def __init__(self):
        pass

    @staticmethod
    def submit_order(self, amount: int, price: float, symbol: str):
        return "submit order success"

    @staticmethod
    def get_account_list():
        url = f"{IB_HOST}/portfolio/accounts"
        return get(url)

    @staticmethod
    def get_portfolio_allocation(account_id: str):
        url = f"{IB_HOST}/portfolio/{account_id}/allocation"
        return get(url)

    @staticmethod
    def get_account_ledger(account_id: str):
        url = f"{IB_HOST}/portfolio/{account_id}/ledger"
        return get(url)

    @staticmethod
    def get_account_attributes(account_id: str):
        url = f"{IB_HOST}/portfolio/{account_id}/meta"
        return get(url)

    @staticmethod
    def get_all_position(account_id: str, page_id: int = 0):
        url = f"{IB_HOST}/portfolio/{account_id}/positions/{page_id}"
        return get(url)

    @staticmethod
    def get_account_summary(account_id: str):
        url = f"{IB_HOST}/portfolio/{account_id}/summary"
        return get(url)

    @staticmethod
    def get_position_for_given_instrument(account_id: str, con_id: str):
        url = f"{IB_HOST}/portfolio/{account_id}/position/{con_id}"
        return get(url)

    @staticmethod
    def get_account_performance(acct_ids: [str]):
        url = f"{IB_HOST}/pa/allperiods"
        json_data = {
            'acctIds': acct_ids
        }
        headers = {
            'Content-Type': 'application/json'
        }
        return post(url, payload=json_data, header=headers)

    @staticmethod
    def get_account_performance_for_given_period(acct_ids: [str], period: str):
        url = f"{IB_HOST}/pa/performance"
        json_data = {
            'acctIds': acct_ids,
            'period': period
        }
        headers = {
            'Content-Type': 'application/json'
        }
        return post(url, payload=json_data, header=headers)

    @staticmethod
    def get_history_transactions(account_id_list: list[str], con_id_list: list[str], currency: str = "USD", days: int = 90):
        url = f"{IB_HOST}/pa/transactions"
        json_data = {
            'acctIds': [account_id_list],
            'conids': [con_id_list],
            'currency': currency,
            'days': days,
        }
        headers = {
            'Content-Type': 'application/json'
        }
        return post(url, payload=json_data, header=headers)

    @staticmethod
    def signatures_and_owners(account_id: str):
        url = f"{IB_HOST}/acesws/{account_id}/signatures-and-owners"
        return get(url)

    @staticmethod
    def switch_account(acc_id: str):
        """
        切换账户
        """
        # 发送 POST 请求
        json_data = {
            'acctId': acc_id
        }
        url = f"{IB_HOST}//iserver/account"
        return post(url,json_data)

    @staticmethod
    def accounts():
        # 发送 GET 请求
        url = f"{IB_HOST}/iserver/accounts"
        return get(url)

    @staticmethod
    def account_profit_and_loss():
        # 发送 GET 请求,调用之前需要先查询账户列表
        url = f"{IB_HOST}/iserver/account/pnl/partitioned"
        return get(url)

    @staticmethod
    def general_account_summary(account_id: str):
        # 发送 GET 请求
        url = f"{IB_HOST}/iserver/account/{account_id}/summary"
        return get(url)

    @staticmethod
    def available_funds(account_id: str):

        # 发送 GET 请求
        url = f"{IB_HOST}/iserver/account/{account_id}/summary/available_funds"
        return get(url)

    @staticmethod
    def balances( account_id: str):
        url = f"{IB_HOST}/iserver/account/{account_id}/summary/balances"
        return get(url)

    @staticmethod
    def margins(account_id: str):
        url = f"{IB_HOST}/iserver/account/{account_id}/summary/margins"
        return get(url)

    @staticmethod
    def market_value(account_id: str):
         url = f"{IB_HOST}/iserver/account/{account_id}/summary/market_value"
         return get(url)

