# base/base_trader.py
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional


class BaseService(ABC):

    @abstractmethod
    def get_account_list(self):
        pass

    @abstractmethod
    def get_portfolio_allocation(self, account_id: str):
        pass

    @abstractmethod
    def get_account_ledger(self, account_id: str):
        pass

    @abstractmethod
    def get_account_attributes(self, account_id: str):
        pass

    @abstractmethod
    def get_all_position(self, account_id: str, page_id: int = 0):
        pass

    @abstractmethod
    def get_account_summary(self, account_id: str):
        pass

    @abstractmethod
    def get_position_for_given_instrument(self, account_id: str, con_id: str):
        pass

    @abstractmethod
    def get_account_performance(self, acct_ids: [str]):
        pass

    @abstractmethod
    def get_account_performance_for_given_period(self, acct_ids: [str], period: str):
        pass

    @abstractmethod
    def get_history_transactions(self, account_id_list: list[str], con_id_list: list[str], currency: str = "USD", days: int = 90):
        pass

    @abstractmethod
    def signatures_and_owners(self, account_id: str):
        pass

    @abstractmethod
    def switch_account(self, acc_id: str):
        pass

    @abstractmethod
    def accounts(self):
        pass

    @abstractmethod
    def account_profit_and_loss(self):
        pass

    @abstractmethod
    def general_account_summary(self, account_id: str):
        pass

    @abstractmethod
    def available_funds(self, account_id: str):
        pass

    @abstractmethod
    def balances(self, account_id: str):
        pass

    @abstractmethod
    def margins(self, account_id: str):
        pass

    @abstractmethod
    def market_value(self, account_id: str):
        pass

    @abstractmethod
    def get_contract_list(self, symbol: str):
        pass

    @abstractmethod
    def get_order_info(self, orderId: str):
        pass

    @abstractmethod
    def get_order_list(self, accountId: str = None):
        pass

    @abstractmethod
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
        pass

    @abstractmethod
    def cancel_order(self, accountId: str, orderId: str):
        pass

    @abstractmethod
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
        pass

    @abstractmethod
    def order_whatif(self,
                     accountId: str,
                     conid: int,
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
        pass

    @abstractmethod
    def order_reply(self, id: str):
        pass

    @abstractmethod
    def get_portfolio_accounts(self):
        pass

    @abstractmethod
    def get_position_info(self, conid: int):
        pass

    @abstractmethod
    def get_sub_accounts(self):
        pass

    @abstractmethod
    def task_handle(self):
        pass
