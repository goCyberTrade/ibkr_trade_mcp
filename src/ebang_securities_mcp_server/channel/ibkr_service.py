# brokers/ib_trader.py
import json
import os
import threading
import time
import schedule
from typing import Any, Dict, Optional

from ebang_securities_mcp_server.channel.ibkr_gateway_manager import IB_HOST_KEY
from ebang_securities_mcp_server.utils.common_request import get, post, delete
from ebang_securities_mcp_server.utils.data_handle import str_to_number
from ebang_securities_mcp_server.channel.base_service import BaseService

IB_HOST = os.getenv("IB_HOST", "https://localhost:5000")
BASE_URL = IB_HOST + "/v1/api"

class IBKrService(BaseService):

    def __init__(self):
        pass

    def get_account_list(self):
        url = f"{BASE_URL}/portfolio/accounts"
        return get(url)

    def get_portfolio_allocation(self, account_id: str):
        url = f"{BASE_URL}/portfolio/{account_id}/allocation"
        return get(url)

    def get_account_ledger(self, account_id: str):
        url = f"{BASE_URL}/portfolio/{account_id}/ledger"
        return get(url)

    def get_account_attributes(self, account_id: str):
        url = f"{BASE_URL}/portfolio/{account_id}/meta"
        return get(url)

    def get_all_position(self, account_id: str, page_id: int = 0):
        url = f"{BASE_URL}/portfolio/{account_id}/positions/{page_id}"
        return get(url)

    def get_account_summary(self, account_id: str):
        url = f"{BASE_URL}/portfolio/{account_id}/summary"
        return get(url)

    def get_position_for_given_instrument(self, account_id: str, con_id: int):
        url = f"{BASE_URL}/portfolio/{account_id}/position/{con_id}"
        return get(url)

    def get_account_performance(self, acct_ids: [str]):
        url = f"{BASE_URL}/pa/allperiods"
        json_data = {
            'acctIds': acct_ids
        }
        headers = {
            'Content-Type': 'application/json'
        }
        return post(url, payload=json_data, header=headers)

    def get_account_performance_for_given_period(self, acct_ids: [str], period: str):
        url = f"{BASE_URL}/pa/performance"
        json_data = {
            'acctIds': acct_ids,
            'period': period
        }
        headers = {
            'Content-Type': 'application/json'
        }
        return post(url, payload=json_data, header=headers)

    def get_history_transactions(self, account_id_list: list[str], con_id_list: list[str], currency: str = "USD", days: int = 90):
        url = f"{BASE_URL}/pa/transactions"
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

    def signatures_and_owners(self, account_id: str):
        url = f"{BASE_URL}/acesws/{account_id}/signatures-and-owners"
        return get(url)

    def switch_account(self, account_id: str):
        """
        切换账户
        """
        # 发送 POST 请求
        json_data = {
            'acctId': account_id
        }
        url = f"{BASE_URL}/iserver/account"
        return post(url, json_data)

    def accounts(self):
        # 发送 GET 请求
        url = f"{BASE_URL}/iserver/accounts"
        return get(url)

    def account_profit_and_loss(self):
        # 发送 GET 请求,调用之前需要先查询账户列表
        url = f"{BASE_URL}/iserver/account/pnl/partitioned"
        return get(url)

    def general_account_summary(self, account_id: str):
        # 发送 GET 请求
        url = f"{BASE_URL}/iserver/account/{account_id}/summary"
        return get(url)

    def available_funds(self, account_id: str):
        # 发送 GET 请求
        url = f"{BASE_URL}/iserver/account/{account_id}/summary/available_funds"
        return get(url)

    def balances(self, account_id: str):
        url = f"{BASE_URL}/iserver/account/{account_id}/summary/balances"
        return get(url)

    def margins(self, account_id: str):
        url = f"{BASE_URL}/iserver/account/{account_id}/summary/margins"
        return get(url)

    def market_value(self, account_id: str):
        url = f"{BASE_URL}/iserver/account/{account_id}/summary/market_value"
        return get(url)


    # 根据用户输入的标的代码查询合约列表信息
    def get_contract_list(self, symbol: str):
        """
        根据用户输入的标的代码查询合约列表信息
        参数:
            symbol: 用户输入的标的代码（可以是股票、期权、货币兑换等），例如苹果股票为AAPL
        返回:
            返回所有合约的结果
        """
        url = f"{BASE_URL}/iserver/secdef/search"
        json_data = {
            "symbol": symbol,
            "pattern": True,  # 模糊匹配的感觉  不传为全词匹配
            "referrer": ""
        }
        return post(url, payload=json_data)


    # 获取指定订单详情
    def get_order_info(self, orderId: str):
        """
        获取美东时间最近一个交易日创建的订单信息
        参数:
            orderId: 必输项，可以指定需要查询的订单详情
        返回:
            订单信息，包含各订单orderId、conid、ticker、orderDesc、sizeAndFills、listingExchange、remainingQuantity、filledQuantity、totalSize、companyName、status、orderType、price、side、lastExecutionTime_r等信息
        """
        url = f"{BASE_URL}/iserver/account/order/status/{orderId}"
        return get(url)

    # 获取当前交易日内提交的所有订单
    def get_order_list(self, accountId: str = None):
        """
        获取美东时间最近一个交易日创建的订单信息
        参数:
            accountId: 可选项，可以指定需要查询的订单属于哪个账户，不指定则是所有账户
        返回:
            订单列表信息，包含各订单orderId、conid、ticker、orderDesc、sizeAndFills、listingExchange、remainingQuantity、filledQuantity、totalSize、companyName、status、orderType、price、side、lastExecutionTime_r等信息
        """

        url = f"{BASE_URL}/iserver/account/orders"
        json_data = {"accountId": accountId} if accountId is not None else {}
        order_list = get(url, json_data)

        # 没有数据室可能没有走缓存需要重新查询一次
        if not order_list.get("orders") and order_list.get("snapshot") is False:
            return get(url, json_data)
        else:
            return order_list

    # 修改订单
    def edit_order(self,
            orderId: str,
            accountId: str,
            orderType: str,
            side: str,
            tif: str,
            quantity: str,
            price: Optional[str] = None,  # 金额
            acctId: Optional[str] = None,
            conidExchange: Optional[str] = None,
            securitiesType: Optional[str] = None,
            clientOrderId: Optional[str] = None,
            parentId: str = None,
            listingExchange: Optional[str] = None,
            isSingleGroup: Optional[bool] = None,
            outsideRTH: Optional[bool] = None,
            auxPrice: Optional[str] = None,  # 金额
            ticker: Optional[str] = None,
            trailingAmount: Optional[str] = None,  # 金额
            trailingType: Optional[str] = None,
            referrer: Optional[str] = None,
            cashQuantity: Optional[str] = None,  # 金额
            useAdaptive: Optional[bool] = None,
            isCurrencyConv: Optional[bool] = None,
            strategy: Optional[str] = None,
            strategyParameters: dict[str, Any] = None):
        """
        根据订单创建的订单编号修改订单，字段下单接口一致，只需要传入需要修改的字段。例如:想修改订单的价格除了必传参数外只需要传入price
        参数:
            orderId: 必输项，需要修改的订单编号
            accountId: 必输项，用户账户编号
            conid: 非必输项，需要使用的渠道标的Id，需要通过用户输入的标的代码去请求get_contract_list接口获取其中的conid
            orderType: 非必输项，订单类型，可以输入的枚举有[LIMIT,MARKET,STOP,STOP_LIMIT,TRAILING_STOP,TRAILING_STOP_LIMIT,MARKETONCLOSE,LIMITONCLOSE],用户没有指定时默认使用LIMIT
            side: 非必输项，买卖方向，可以输入的枚举有[BUY,SELL,CLOSE]
            tif: 非必输项，订单时效，可以输入的枚举有[DAY,IOC,GTC,OPG,PAX]，用户没有指定时默认使用DAY
            quantity: 非必输项，下单数量
            price: 非必输项，当订单类型为MARKET或者MARKETONCLOSE时不用输入。订单类型为其他时必输
            acctId: 非必输项，订单接收的账户，默认为自己的账户
            conidExchange: 非必输项，指定conid对应的路由目的地
            securitiesType: 非必输项，订单接收交易所
            clientOrderId: 非必输项，客户可配置的订单标识符
            parentId: 非必输项，若该订单是组合订单（bracket order）中的子订单，则 parentId 字段必须设置为与父订单的 client_order_id 一致
            listingExchange: 非必输项，The listing exchange of the instrument.
            isSingleGroup: 非必输项，Indicates that all orders in the containing array are to be treated as an OCA group.
            outsideRTH: 非必输项，是否允许交易时段外成交订单，默认false
            auxPrice: 非必输项，Additional price value used in certain order types, such as stop orders.
            ticker: 非必输项，Ticker symbol of the instrument.
            trailingAmount: 非必输项，Offset used with Trailing orders
            trailingType: 非必输项，Specifies the type of trailing used with a Trailing order，可以输入的枚举有[amt,%]
            referrer: 渠道内部标识
            cashQuantity: Quantity of currency used with cash quantity orders
            useAdaptive: Instructs Route to apply the Price Management Algo
            isCurrencyConv: Indicates that a forex order is for currency conversion and should not entail a virtual forex position in the account, where applicable
            strategy: The name of an execution algorithm
            strategyParameters: Parameters governing the selected algorithm, if applicable
        返回:
            订单修改结果，当结果为以下格式时代表创建成功。
            {
              "order_id": "987654",
              "order_status": "Submitted",
              "encrypt_message": "1"
            }
            当创建结果为以下格式时表示订单被抑制，需要提示用户确认，用户确认后使用返回里面的id(订单抑制唯一标识)调用订单确认接口(order_reply)
            {
            "id": "07a13a5a-4a48-44a5-bb25-5ab37b79186c",
            "message": [
              "The following order \"BUY 100 AAPL NASDAQ.NMS @ 165.0\" price exceeds \nthe Percentage constraint of 3%.\nAre you sure you want to submit this order?"
            ],
            "isSuppressed": false,
            "messageIds": [
              "o163"
            ]}
          }
        """

        url = f"{BASE_URL}/iserver/account/{accountId}/order/{orderId}"

        # 查询原订单数据，填充必输项
        order_info_rtn = self.get_order_info(orderId)

        # 查询历史订单数据  从中取得匹配当前订单编号的这条数据
        order_list = self.get_order_list(accountId)
        matching_order = None
        for order in order_list.get("orders", []):
            if str(order.get("orderId")) == orderId:
                matching_order = order
                break

        # 输出结果
        if not matching_order:
            raise Exception(f"未找到 orderId 为 {orderId} 的订单")

        json_data = {
            "acctId": acctId,
            "conid": matching_order["conid"],
            "conidex": conidExchange,
            "secType": securitiesType,
            "cOID": clientOrderId,
            "parentId": parentId,
            "listingExchange": listingExchange,
            "isSingleGroup": isSingleGroup,
            "outsideRTH": outsideRTH,
            "auxPrice": str_to_number(auxPrice) if auxPrice is not None else None,
            "ticker": ticker,
            "trailingAmt": str_to_number(trailingAmount) if trailingAmount is not None else None,
            "trailingType": trailingType,
            "referrer": referrer,
            "cashQty": str_to_number(cashQuantity) if cashQuantity is not None else None,
            "useAdaptive": useAdaptive,
            "isCcyConv": isCurrencyConv,
            "orderType": orderType if orderType is not None else str(matching_order["orderType"]).upper(),
            "side": side if side is not None else matching_order["side"],
            "tif": tif if tif is not None else order_info_rtn["tif"],
            "quantity": str_to_number(quantity) if quantity is not None else matching_order["totalSize"],
            "strategy": strategy,
            "strategyParameters": strategyParameters
        }

        # 价格特殊设置 市价单有可能不存在
        if price is not None:
            json_data["price"] = str_to_number(price)
        else:
            if matching_order["price"]:
                json_data["price"] = str_to_number(matching_order["price"])

        # 过滤所有值为None的字段
        json_data_conv = {k: v for k, v in json_data.items() if v is not None}
        return post(url, json_data_conv)


    # 取消订单
    def cancel_order(self, accountId: str, orderId: str):
        """
            对取消没有成交的订单，提交取消请求
            参数:
            accountId: 用户账户编号
            orderId: 订单编号
        返回:
            提交取消请求的结果
        """
        url = f"{BASE_URL}/iserver/account/{accountId}/order/{orderId}"
        return delete(url)


    # 创建订单
    def create_order(self,
            conid: int,
            accountId: str,
            orderType: str,
            side: str,
            tif: str,
            quantity: str,
            price: Optional[str] = None,  # 金额
            acctId: Optional[str] = None,
            conidExchange: Optional[str] = None,
            securitiesType: Optional[str] = None,
            clientOrderId: Optional[str] = None,
            parentId: str = None,
            listingExchange: Optional[str] = None,
            isSingleGroup: Optional[bool] = None,
            outsideRTH: Optional[bool] = None,
            auxPrice: Optional[str] = None,  # 金额
            ticker: Optional[str] = None,
            trailingAmount: Optional[str] = None,  # 金额
            trailingType: Optional[str] = None,
            referrer: Optional[str] = None,
            cashQuantity: Optional[str] = None,  # 金额
            useAdaptive: Optional[bool] = None,
            isCurrencyConv: Optional[bool] = None,
            strategy: Optional[str] = None,
            strategyParameters: dict[str, Any] = None):
        """
        创建订单
        参数:
            accountId: 必输项，用户账户编号
            conid: 必输项，需要使用的渠道标的Id，需要通过用户输入的标的代码去请求get_contract_list接口获取其中的conid
            orderType: 必输项，订单类型，可以输入的枚举有[LIMIT,MARKET,STOP,STOP_LIMIT,TRAILING_STOP,TRAILING_STOP_LIMIT,MARKETONCLOSE,LIMITONCLOSE],用户没有指定时默认使用LIMIT
            side: 必输项，买卖方向，可以输入的枚举有[BUY,SELL,CLOSE]
            tif: 必输项，订单时效，可以输入的枚举有[DAY,IOC,GTC,OPG,PAX]，用户没有指定时默认使用DAY
            quantity: 必输项，下单数量
            price: 非必输项，当订单类型为MARKET或者MARKETONCLOSE时不用输入。订单类型为其他时必输
            acctId: 非必输项，订单接收的账户，默认为自己的账户
            conidExchange: 非必输项，指定conid对应的路由目的地
            securitiesType: 非必输项，订单接收交易所
            clientOrderId: 非必输项，客户可配置的订单标识符
            parentId: 非必输项，若该订单是组合订单（bracket order）中的子订单，则 parentId 字段必须设置为与父订单的 client_order_id 一致
            listingExchange: 非必输项，The listing exchange of the instrument.
            isSingleGroup: 非必输项，Indicates that all orders in the containing array are to be treated as an OCA group.
            outsideRTH: 非必输项，是否允许交易时段外成交订单，默认false
            auxPrice: 非必输项，Additional price value used in certain order types, such as stop orders.
            ticker: 非必输项，Ticker symbol of the instrument.
            trailingAmount: 非必输项，Offset used with Trailing orders
            trailingType: 非必输项，Specifies the type of trailing used with a Trailing order，可以输入的枚举有[amt,%]
            referrer: 渠道内部标识
            cashQuantity: Quantity of currency used with cash quantity orders
            useAdaptive: Instructs Route to apply the Price Management Algo
            isCurrencyConv: Indicates that a forex order is for currency conversion and should not entail a virtual forex position in the account, where applicable
            strategy: The name of an execution algorithm
            strategyParameters: Parameters governing the selected algorithm, if applicable
        返回:
            订单创建结果，当创建结果为以下格式时代表创建成功。
            {
              "order_id": "987654",
              "order_status": "Submitted",
              "encrypt_message": "1"
            }
            当创建结果为以下格式时表示订单被抑制，需要提示用户确认，用户确认后使用返回里面的id(订单抑制唯一标识)调用订单确认接口(order_reply)
            {
            "id": "07a13a5a-4a48-44a5-bb25-5ab37b79186c",
            "message": [
              "The following order \"BUY 100 AAPL NASDAQ.NMS @ 165.0\" price exceeds \nthe Percentage constraint of 3%.\nAre you sure you want to submit this order?"
            ],
            "isSuppressed": false,
            "messageIds": [
              "o163"
            ]}
        """
        url = f"{BASE_URL}/iserver/account/{accountId}/orders"
    
        json_data = {
            "acctId": acctId,
            "conid": conid,
            "conidex": conidExchange,
            "secType": securitiesType,
            "cOID": clientOrderId,
            "parentId": parentId,
            "listingExchange": listingExchange,
            "isSingleGroup": isSingleGroup,
            "outsideRTH": outsideRTH,
            "auxPrice": str_to_number(auxPrice) if auxPrice is not None else None,
            "ticker": ticker,
            "trailingAmt": str_to_number(trailingAmount) if trailingAmount is not None else None,
            "trailingType": trailingType,
            "referrer": referrer,
            "cashQty": str_to_number(cashQuantity) if cashQuantity is not None else None,
            "useAdaptive": useAdaptive,
            "isCcyConv": isCurrencyConv,
            "orderType": orderType,
            "price": str_to_number(price) if price is not None else None,
            "side": side,
            "tif": tif,
            "quantity": str_to_number(quantity) if quantity is not None else None,
            "strategy": strategy,
            "strategyParameters": strategyParameters
        }
        # 过滤所有值为None的字段
        json_data_conv = {k: v for k, v in json_data.items() if v is not None}
        # 订单参数发送格式
        send_param = {
            "orders": [
                json_data_conv
            ]
        }
    
        return post(url, send_param)


    # 订单试算
    def order_whatif(self,
            conid: int,
            accountId: str,
            orderType: str,
            side: str,
            tif: str,
            quantity: str,
            price: Optional[str] = None,  # 金额
            acctId: Optional[str] = None,
            conidExchange: Optional[str] = None,
            securitiesType: Optional[str] = None,
            clientOrderId: Optional[str] = None,
            parentId: str = None,
            listingExchange: Optional[str] = None,
            isSingleGroup: Optional[bool] = None,
            outsideRTH: Optional[bool] = None,
            auxPrice: Optional[str] = None,  # 金额
            ticker: Optional[str] = None,
            trailingAmount: Optional[str] = None,  # 金额
            trailingType: Optional[str] = None,
            referrer: Optional[str] = None,
            cashQuantity: Optional[str] = None,  # 金额
            useAdaptive: Optional[bool] = None,
            isCurrencyConv: Optional[bool] = None,
            strategy: Optional[str] = None,
            strategyParameters: dict[str, Any] = None):
        """
        订单试算接口，在提交订单前调用可以预估订单需要的佣金和手续费信息，以及进行下单资金的预校验处理
        参数:
            accountId: 必输项，用户账户编号
            conid: 必输项，需要使用的渠道标的Id，需要通过用户输入的标的代码去请求get_contract_list接口获取其中的conid
            orderType: 必输项，订单类型，可以输入的枚举有[LIMIT,MARKET,STOP,STOP_LIMIT,TRAILING_STOP,TRAILING_STOP_LIMIT,MARKETONCLOSE,LIMITONCLOSE],用户没有指定时默认使用LIMIT
            side: 必输项，买卖方向，可以输入的枚举有[BUY,SELL,CLOSE]
            tif: 必输项，订单时效，可以输入的枚举有[DAY,IOC,GTC,OPG,PAX]，用户没有指定时默认使用DAY
            quantity: 必输项，下单数量
            price: 非必输项，当订单类型为MARKET或者MARKETONCLOSE时不用输入。订单类型为其他时必输
            acctId: 非必输项，订单接收的账户，默认为自己的账户
            conidExchange: 非必输项，指定conid对应的路由目的地
            securitiesType: 非必输项，订单接收交易所
            clientOrderId: 非必输项，客户可配置的订单标识符
            parentId: 非必输项，若该订单是组合订单（bracket order）中的子订单，则 parentId 字段必须设置为与父订单的 client_order_id 一致
            listingExchange: 非必输项，The listing exchange of the instrument.
            isSingleGroup: 非必输项，Indicates that all orders in the containing array are to be treated as an OCA group.
            outsideRTH: 非必输项，是否允许交易时段外成交订单，默认false
            auxPrice: 非必输项，Additional price value used in certain order types, such as stop orders.
            ticker: 非必输项，Ticker symbol of the instrument.
            trailingAmount: 非必输项，Offset used with Trailing orders
            trailingType: 非必输项，Specifies the type of trailing used with a Trailing order，可以输入的枚举有[amt,%]
            referrer: 渠道内部标识
            cashQuantity: Quantity of currency used with cash quantity orders
            useAdaptive: Instructs Route to apply the Price Management Algo
            isCurrencyConv: Indicates that a forex order is for currency conversion and should not entail a virtual forex position in the account, where applicable
            strategy: The name of an execution algorithm
            strategyParameters: Parameters governing the selected algorithm, if applicable
        返回:
            订单试算结果，预估的佣金、手续费、持仓变动情况以及资金预校验情况
        """
        url = f"{BASE_URL}/iserver/account/{accountId}/orders/whatif"
    
        json_data = {
            "acctId": acctId,
            "conid": conid,
            "conidex": conidExchange,
            "secType": securitiesType,
            "cOID": clientOrderId,
            "parentId": parentId,
            "listingExchange": listingExchange,
            "isSingleGroup": isSingleGroup,
            "outsideRTH": outsideRTH,
            "auxPrice": str_to_number(auxPrice) if auxPrice is not None else None,
            "ticker": ticker,
            "trailingAmt": str_to_number(trailingAmount) if trailingAmount is not None else None,
            "trailingType": trailingType,
            "referrer": referrer,
            "cashQty": str_to_number(cashQuantity) if cashQuantity is not None else None,
            "useAdaptive": useAdaptive,
            "isCcyConv": isCurrencyConv,
            "orderType": orderType,
            "price": str_to_number(price) if price is not None else None,
            "side": side,
            "tif": tif,
            "quantity": str_to_number(quantity) if quantity is not None else None,
            "strategy": strategy,
            "strategyParameters": strategyParameters
        }
        # 过滤所有值为None的字段
        json_data_conv = {k: v for k, v in json_data.items() if v is not None}
        # 订单参数发送格式
        send_param = {
            "orders": [
                json_data_conv
            ]
        }
    
        return post(url, send_param)


    # 订单确认
    def order_reply(self, id: str):
        """
        当下单时订单被抑制时，确认订单，让订单进行后续流程
        参数:
            id: 必输项，订单抑制唯一标识
        返回:
            订单确认后提交结果
        """
        url = f"{BASE_URL}/iserver/reply/{id}"

        json_data = {
            "confirmed": True
        }
        return post(url, json_data)


    # 获取账户列表
    def get_portfolio_accounts(self):
        """
        获取指定账户列表
        返回:
            该合约编号对应的持仓详情，包含symbol、position、mktPrice、mktValue、avgCost、currency、avgPrice、assetClass等信息
        """

        url = f"{BASE_URL}/portfolio/accounts"
        return get(url)


    # 获取指定标的的持仓详情
    def get_position_info(self, conid: int):
        """
        获取指定的持仓详情
        参数:
            必输项，需要使用的渠道标的Id，需要通过用户输入的标的代码去请求get_contract_list接口获取其中的conid
        返回:
            该合约编号对应的持仓详情，包含symbol、position、mktPrice、mktValue、avgCost、currency、avgPrice、assetClass等信息
        """

        url = f"{BASE_URL}/portfolio/positions/{conid}"
        return get(url)


    # 获取子账户列表
    def get_sub_accounts(self):
        """
        获取所有的子账户列表
        返回:
            所有的子账户信息，包含accountId、currency、type、tradingType、businessType、parent(主账户信息)等
        """

        url = f"{BASE_URL}/portfolio/subaccounts"
        return get(url)

    # 获取会话状态
    def get_auth_status(self):

        url = f"{BASE_URL}/iserver/auth/status"
        return post(url)

    # 初始认证会话
    def ssodh_init(self):
        url = f"{BASE_URL}/iserver/auth/ssodh/init"
        json_data = {"publish": True, "compete": True}
        return post(url, json_data)

    # 心跳检测
    def heartbeat(self):

        IB_HOST = os.getenv(IB_HOST_KEY, '')
        if not IB_HOST:
            print("未配置 IB_HOST 环境变量，检测任务不启动任务未启动")
            return
        try:
            status_res = self.get_auth_status()
            # 验证 authenticated 字段
            if 'authenticated' in status_res and status_res['authenticated'] is False:
                # 初始化认证下
                self.ssodh_init()
        except Exception as e:
            print(f"heartbeat error: {e}")

    # 渠道定时任务
    def scheduler_target(self):
        # 设置每60秒执行一次请求
        schedule.every(60).seconds.do(self.heartbeat)
        # 持续运行调度器
        while True:
            schedule.run_pending()
            time.sleep(0.1)

    # 渠道定时任务
    def task_handle(self):
        # 创建并启动调度器线程
        scheduler_thread = threading.Thread(target=self.scheduler_target, daemon=True)
        scheduler_thread.start()


if __name__ == '__main__':
    se = IBKrService()
    se.edit_order("540399765", "DUM576344", "LIMIT", None, None, "8", "195")