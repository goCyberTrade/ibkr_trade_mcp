# # brokers/ib_trader.py
# from base_service import BaseService
# from typing import Dict, Any
# import logging
# from ibapi.client import EClient
# from ibapi.wrapper import EWrapper
# from ibapi.contract import Contract
# from ibapi.order import Order
# import threading
# import time
#
# class IBTrader(BaseService):
#     """盈透证券(IB)交易接口实现"""
#
#     def __init__(self, config: Dict[str, Any]):
#         EClient.__init__(self, self)
#         BaseTrader.__init__(self, config)
#         self.logger = logging.getLogger(__name__)
#         self.host = config.get("host", "127.0.0.1")
#         self.port = config.get("port", 7496)
#         self.client_id = config.get("client_id", 0)
#         self.order_id = 0
#         self.connect_event = threading.Event()
#         self.order_status = {}
#
#     def connect(self) -> bool:
#         """连接IB TWS/Gateway"""
#         try:
#             self.connect(self.host, self.port, self.client_id)
#             thread = threading.Thread(target=self.run)
#             thread.daemon = True
#             thread.start()
#
#             # 等待连接建立
#             time.sleep(1)
#             if self.isConnected():
#                 self.logger.info(f"成功连接到IB服务器: {self.host}:{self.port}")
#                 self.connect_event.set()
#                 return True
#             else:
#                 self.logger.error("连接IB服务器失败")
#                 return False
#         except Exception as e:
#             self.logger.error(f"连接IB服务器异常: {str(e)}")
#             return False
#
#     def disconnect(self) -> bool:
#         """断开IB连接"""
#         if self.isConnected():
#             self.disconnect()
#             self.logger.info("已断开IB连接")
#             return True
#         return False
#
#     def next_order_id(self) -> int:
#         """获取下一个订单ID"""
#         self.order_id += 1
#         return self.order_id
#
#     def place_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
#         """实现下单接口"""
#         try:
#             # 等待连接建立
#             if not self.connect_event.wait(timeout=5):
#                 return {"status": "error", "message": "IB连接未建立"}
#
#             # 创建合约
#             contract = Contract()
#             contract.symbol = order_data["symbol"]
#             contract.secType = order_data.get("sec_type", "STK")
#             contract.exchange = order_data.get("exchange", "SMART")
#             contract.currency = order_data.get("currency", "USD")
#
#             # 创建订单
#             order = Order()
#             order.action = order_data["side"]
#             order.totalQuantity = order_data["quantity"]
#             order.orderType = order_data.get("order_type", "MKT")
#
#             if order.orderType == "LIMIT":
#                 order.lmtPrice = order_data["price"]
#
#             order_id = self.next_order_id()
#             self.placeOrder(order_id, contract, order)
#
#             return {"status": "success", "order_id": str(order_id)}
#         except Exception as e:
#             self.logger.error(f"下单异常: {str(e)}")
#             return {"status": "error", "message": str(e)}
#
#     # 实现IB API回调方法
#     def error(self, reqId, errorCode, errorString):
#         self.logger.error(f"Error: {reqId} {errorCode} {errorString}")
#
#     def nextValidId(self, orderId: int):
#         self.logger.info(f"Next valid order ID: {orderId}")
#         self.order_id = max(self.order_id, orderId)
#
#     def orderStatus(self, orderId, status, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld, mktCapPrice):
#         self.logger.info(f"Order Status: {orderId}, {status}, {filled}, {remaining}")
#         self.order_status[orderId] = {
#             "status": status,
#             "filled": filled,
#             "remaining": remaining,
#             "avgFillPrice": avgFillPrice
#         }
#
#     # 其他接口方法实现（cancel_order, query_order, query_position）略...