from typing import Any

from pydantic import Field

from ebang_securities_mcp_server.channel.channel_factory import ChannelFactory, Channel

tools = []


# Query the contract list information according to the underlying code entered by the user.
@tools.append
def get_contract_list(channel: str = Field(description="The channel", default="ibkr"),
                      symbol: str = Field(description="The underlying codes entered by users can include stocks, options, currency exchange, etc. For example, the code for Apple stock is AAPL.")):
    """
    Query the contract list information according to the underlying code entered by the user.
    Return:
        Return the results of all contracts related to the subject.including conId, symbol, description, secType, etc.
    """
    return ChannelFactory.create(channel).get_contract_list(symbol)


# Get Specified Order Details
@tools.append
def get_order_info(channel: str = Field(description="The channel", default="ibkr"),
                   orderId: str = Field(description="The created order ID")):
    """
    Obtain the order information created on the most recent trading day in Eastern Time (ET) and the information of incomplete orders created on previous trading days.
    Returns:
        Order information including orderId, conid, ticker, orderDesc, sizeAndFills, listingExchange, remainingQuantity, filledQuantity, totalSize, companyName, status, orderType, price, side, lastExecutionTime, etc. for each order.
    """

    return ChannelFactory.create(channel).get_order_info(orderId)


# Get All Orders Submitted on the Current Trading Day
@tools.append
def get_order_list(channel: str = Field(description="The channel", default="ibkr"),
                   accountId: str = Field(description="Can specify which account the orders to be queried belong to; if not specified, it will be all accounts",
                                          default=None)):
    """
    Obtain the order information created on the most recent trading day in Eastern Time (ET) and the information of incomplete orders created on previous trading days.
    Returns:
        Order list information, including orderId, conid, ticker, orderDesc, sizeAndFills, listingExchange, remainingQuantity, filledQuantity, totalSize, companyName, status, orderType, price, side, lastExecutionTime, etc. for each order.
    """
    return ChannelFactory.create(channel).get_order_list(accountId)


# edit order
@tools.append
def edit_order(
        channel: str = Field(description="The channel", default="ibkr"),
        orderId: str = Field(description="Order ID to be modified"),
        accountId: str = Field(description="User account number"),
        orderType: str = Field(description="Order type, acceptable enums are [LIMIT, MARKET, STOP, STOP_LIMIT, TRAILING_STOP, TRAILING_STOP_LIMIT, MARKETONCLOSE, LIMITONCLOSE]", default=None),
        side: str = Field(description="Buy/sell direction, acceptable enums are [BUY, SELL, CLOSE]", default=None),
        tif: str = Field(description="Order time-in-force, acceptable enums are [DAY, IOC, GTC, OPG, PAX]", default=None),
        quantity: str = Field(description="Order quantity", default=None),
        price: str = Field(description="Not required when order type is MARKET or MARKETONCLOSE. Required for other order types", default=None),
        acctId: str = Field(description="Order receiving account, default is self account", default=None),
        conidExchange: str = Field(description="Specified routing destination for conid", default=None),
        securitiesType: str = Field(description="Order receiving exchange", default=None),
        clientOrderId: str = Field(description="Client-configurable order identifier", default=None),
        parentId: str = Field(description="If this order is a child order in a bracket order, the parentId field must be set to the same as the parent order's client_order_id", default=None),
        listingExchange: str = Field(description="The listing exchange of the instrument.", default=None),
        isSingleGroup: bool = Field(description="Indicates that all orders in the containing array are to be treated as an OCA group.", default=None),
        outsideRTH: bool = Field(description="Whether to allow order execution outside regular trading hours, default is false", default=None),
        auxPrice: str = Field(description="Additional price value used in certain order types, such as stop orders.", default=None),
        ticker: str = Field(description="Ticker symbol of the instrument.", default=None),
        trailingAmount: str = Field(description="Offset used with Trailing orders", default=None),
        trailingType: str = Field(description="Specifies the type of trailing used with a Trailing order, acceptable enums are [amt, %]", default=None),
        referrer: str = Field(description="Internal channel identifier", default=None),
        cashQuantity: str = Field(description="Quantity of currency used with cash quantity orders", default=None),
        useAdaptive: bool = Field(description="Instructs Route to apply the Price Management Algo", default=None),
        isCurrencyConv: bool = Field(description="Indicates that a forex order is for currency conversion and should not entail a virtual forex position in the account, where applicable", default=None),
        strategy: str = Field(description="The name of an execution algorithm", default=None),
        strategyParameters: dict[str, Any] = Field(description="Parameters governing the selected algorithm, if applicable", default=None)):

    """
    Modify an order based on its created order number. The fields are consistent with the order placement interface, and only the fields to be modified need to be passed in. For example, to modify an order's price, only the price field needs to be passed in addition to mandatory parameters.
    Returns:
        Order modification result. When the result is in the following format, it indicates successful creation:
        {
          "order_id": "987654",
          "order_status": "Submitted"
        }
        When the creation result is in the following format, it means the order is suppressed and requires user confirmation. After the user confirms, use the returned id (unique identifier for order suppression) to call the order confirmation interface (order_reply):
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
    return ChannelFactory.create(channel).edit_order(
        orderId,
        accountId,
        orderType,
        side,
        tif,
        quantity,
        price,
        acctId,
        conidExchange,
        securitiesType,
        clientOrderId,
        parentId,
        listingExchange,
        isSingleGroup,
        outsideRTH,
        auxPrice,
        ticker,
        trailingAmount,
        trailingType,
        referrer,
        cashQuantity,
        useAdaptive,
        isCurrencyConv,
        strategy,
        strategyParameters)


# cancel order
@tools.append
def cancel_order(channel: str = Field(description="The channel", default="ibkr"),
                 accountId: str = Field(description="user account id"),
                 orderId: str = Field(description="The created order ID")):
    """
    Submit a cancellation request for unfilled orders.
    Returns:
        Return the result of cancel request submission, such as:
        {
            "msg": "Request was submitted",
            "order_id": 71340813
        }
    """
    return ChannelFactory.create(channel).cancel_order(accountId, orderId)


# create order
@tools.append
def create_order(
        channel: str = Field(description="The channel", default="ibkr"),
        conid: int = Field(description="The channel underlying instrument ID to be used needs to obtain the conid from the get_contract_list interface by requesting with the underlying code input by the user."),
        accountId: str = Field(description="User account number"),
        orderType: str = Field(description="Order type, acceptable enums are [LIMIT, MARKET, STOP, STOP_LIMIT, TRAILING_STOP, TRAILING_STOP_LIMIT, MARKETONCLOSE, LIMITONCLOSE]", default="LIMIT"),
        side: str = Field(description="Buy/sell direction, acceptable enums are [BUY, SELL, CLOSE]"),
        tif: str = Field(description="Order time-in-force, acceptable enums are [DAY, IOC, GTC, OPG, PAX]", default="DAY"),
        quantity: str = Field(description="Order quantity"),
        price: str = Field(description="This parameter is required for the following order types:[LIMIT, STOP, STOP_LIMIT, TRAILING_STOP, TRAILING_STOP_LIMIT, LIMITONCLOSE];This parameter is not required for:[MARKET, MARKETONCLOSE]", default= None),
        acctId: str = Field(description="Order receiving account, default is self account", default=None),
        conidExchange: str = Field(description="Specified routing destination for conid", default=None),
        securitiesType: str = Field(description="Order receiving exchange", default=None),
        clientOrderId: str = Field(description="Client-configurable order identifier", default=None),
        parentId: str = Field(description="If this order is a child order in a bracket order, the parentId field must be set to the same as the parent order's client_order_id", default=None),
        listingExchange: str = Field(description="The listing exchange of the instrument.", default=None),
        isSingleGroup: bool = Field(description="Indicates that all orders in the containing array are to be treated as an OCA group.", default=None),
        outsideRTH: bool = Field(description="Whether to allow order execution outside regular trading hours, default is false", default=None),
        auxPrice: str = Field(description="Additional price value used in certain order types, such as stop orders.", default=None),
        ticker: str = Field(description="Ticker symbol of the instrument.", default=None),
        trailingAmount: str = Field(description="Offset used with Trailing orders", default=None),
        trailingType: str = Field(description="Specifies the type of trailing used with a Trailing order, acceptable enums are [amt, %]", default=None),
        referrer: str = Field(description="Internal channel identifier", default=None),
        cashQuantity: str = Field(description="Quantity of currency used with cash quantity orders", default=None),
        useAdaptive: bool = Field(description="Instructs Route to apply the Price Management Algo", default=None),
        isCurrencyConv: bool = Field(description="Indicates that a forex order is for currency conversion and should not entail a virtual forex position in the account, where applicable", default=None),
        strategy: str = Field(description="The name of an execution algorithm", default=None),
        strategyParameters: dict[str, Any] = Field(description="Parameters governing the selected algorithm, if applicable", default=None)):
    """
    Create a new order.
    Returns:
        Order creation result. Successful creation returns:
        {
          "order_id": "987654",
          "order_status": "Submitted"
        }
        A suppressed order requires user confirmation. Use the returned id(Order Suppression Unique Identifier) to call order_reply after confirmation:
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
    return ChannelFactory.create(channel).create_order(
        conid,
        accountId,
        orderType,
        side,
        tif,
        quantity,
        price,
        acctId,
        conidExchange,
        securitiesType,
        clientOrderId,
        parentId,
        listingExchange,
        isSingleGroup,
        outsideRTH,
        auxPrice,
        ticker,
        trailingAmount,
        trailingType,
        referrer,
        cashQuantity,
        useAdaptive,
        isCurrencyConv,
        strategy,
        strategyParameters)


# Order Calculation Preview
@tools.append
def order_whatif(
        channel: str = Field(description="The channel", default="ibkr"),
        conid: int = Field(description="The channel underlying instrument ID to be used needs to obtain the conid from the get_contract_list interface by requesting with the underlying code input by the user."),
        accountId: str = Field(description="User account number"),
        orderType: str = Field(description="Order type, acceptable enums are [LIMIT, MARKET, STOP, STOP_LIMIT, TRAILING_STOP, TRAILING_STOP_LIMIT, MARKETONCLOSE, LIMITONCLOSE]", default="LIMIT"),
        side: str = Field(description="Buy/sell direction, acceptable enums are [BUY, SELL, CLOSE]"),
        tif: str = Field(description="Order time-in-force, acceptable enums are [DAY, IOC, GTC, OPG, PAX]", default="DAY"),
        quantity: str = Field(description="Order quantity"),
        price: str = Field(description="Not required when order type is MARKET or MARKETONCLOSE. Required for other order types"),
        acctId: str = Field(description="Order receiving account, default is self account", default=None),
        conidExchange: str = Field(description="Specified routing destination for conid", default=None),
        securitiesType: str = Field(description="Order receiving exchange", default=None),
        clientOrderId: str = Field(description="Client-configurable order identifier", default=None),
        parentId: str = Field(description="If this order is a child order in a bracket order, the parentId field must be set to the same as the parent order's client_order_id", default=None),
        listingExchange: str = Field(description="The listing exchange of the instrument.", default=None),
        isSingleGroup: bool = Field(description="Indicates that all orders in the containing array are to be treated as an OCA group.", default=None),
        outsideRTH: bool = Field(description="Whether to allow order execution outside regular trading hours, default is false", default=None),
        auxPrice: str = Field(description="Additional price value used in certain order types, such as stop orders.", default=None),
        ticker: str = Field(description="Ticker symbol of the instrument.", default=None),
        trailingAmount: str = Field(description="Offset used with Trailing orders", default=None),
        trailingType: str = Field(description="Specifies the type of trailing used with a Trailing order, acceptable enums are [amt, %]", default=None),
        referrer: str = Field(description="Internal channel identifier", default=None),
        cashQuantity: str = Field(description="Quantity of currency used with cash quantity orders", default=None),
        useAdaptive: bool = Field(description="Instructs Route to apply the Price Management Algo", default=None),
        isCurrencyConv: bool = Field(description="Indicates that a forex order is for currency conversion and should not entail a virtual forex position in the account, where applicable", default=None),
        strategy: str = Field(description="The name of an execution algorithm", default=None),
        strategyParameters: dict[str, Any] = Field(description="Parameters governing the selected algorithm, if applicable", default=None)):
    """
    Order calculation interface. Calling before submitting an order can estimate commission and fee information, and perform pre-validation of order funds.
    Returns:
        Order calculation results, including estimated commissions, fees, position changes, and fund pre-validation status.
    """

    return ChannelFactory.create(channel).order_whatif(
        conid,
        accountId,
        orderType,
        side,
        tif,
        quantity,
        price,
        acctId,
        conidExchange,
        securitiesType,
        clientOrderId,
        parentId,
        listingExchange,
        isSingleGroup,
        outsideRTH,
        auxPrice,
        ticker,
        trailingAmount,
        trailingType,
        referrer,
        cashQuantity,
        useAdaptive,
        isCurrencyConv,
        strategy,
        strategyParameters)


# Order Confirmation
@tools.append
def order_reply(channel: str = Field(description="The channel", default="ibkr"),
                id: str = Field(description="Order Suppression Unique Identifier")):
    """
    Confirm a suppressed order during placement to allow it to proceed with subsequent processing.
    Returns:
        The submission result after order confirmation.
    """
    return ChannelFactory.create(channel).order_reply(id)


# Get Account List
@tools.append
def get_portfolio_accounts(channel: str = Field(description="The channel", default="ibkr")):
    """
    Get Account List
    Returns:
        All account information, including accountId, currency, type, tradingType, businessType, parent (primary account information), etc.
    """

    return ChannelFactory.create(channel).get_portfolio_accounts()


# Retrieve position details of a specified underlying asset.
@tools.append
def get_position_info(channel: str = Field(description="The channel", default="ibkr"),
                      conid: int = Field(description="The channel underlying instrument ID to be used needs to obtain the conid from the get_contract_list interface by requesting with the underlying code input by the user.")):
    """
    Retrieve position details of a specified underlying asset.
    Returns:
        The position details corresponding to this contract number, including information such as symbol, position, mktPrice, mktValue, avgCost, currency, avgPrice, assetClass, etc.
    """
    return ChannelFactory.create(channel).get_position_info(conid)

# Get Sub Account List
@tools.append
def get_sub_accounts(channel: str = Field(description="The channel", default="ibkr")):
    """
    Get Sub Account List
    Returns:
        All subAccount information, including accountId, currency, type, tradingType, businessType, parent (primary account information), etc.
    """
    return ChannelFactory.create(channel).get_sub_accounts()
