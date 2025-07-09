from typing import List

from pydantic import Field

from ebang_securities_mcp_server.channel.channel_factory import ChannelFactory

tools = []


@tools.append
def get_portfolio_allocation(channel: str = Field(description="The channel.", default="ibkr"),
                             accountId: str = Field(description="Account ID whose cached portfolio positions will be discarded.")):
    """
    Get An Account's Allocations By Asset Class, Sector Group, And Sector.
    Returns:
            assetClass: Object containing values of positions sorted by long/short and asset class.
                long: Object containing value of long positions in the account aggregated by asset class.
                short: Object containing value of short positions in the account aggregated by asset class.
            sector: Object containing values of positions sorted by long/short and Sector.
                long: Object containing value of long positions in the account aggregated by sector.
                short: Object containing value of short positions in the account aggregated by sector.
            group: Object containing values of positions sorted by long/short and Sector Group.
                long: Object containing value of long positions in the account aggregated by Sector Group.
                short: Object containing value of short positions in the account aggregated by Sector Group.
            return examples:
                {
                    "assetClass": {
                        "long": {
                            "CRYPTO": 255.17,
                            "OPT": 44352.82,
                            "STK": 1564447.6240790943,
                            "BOND": 380106.54,
                            "CASH": 72425.68706744915
                        },
                        "short": {
                            "OPT": -80.53,
                            "STK": -103716.11109948158,
                            "CASH": -508096.16629793524
                        }
                    },
                    "sector": {
                        "long": {
                            "Others": 704313.8907064605,
                            "Industrial": 380106.54,
                            "Technology": 309264.47000000003,
                            "Consumer, Cyclical": 18213.43337263364,
                            "Communications": 164576.99,
                            "Financial": 412637.11,
                            "Consumer, Non-cyclical": 49.72
                        },
                        "short": {
                            "Technology": -87162,
                            "Consumer, Cyclical": -11763,
                            "Communications": -189.53,
                            "Financial": -4682.111099481583
                        }
                    },
                    "group": {
                        "long": {
                            "Computers": 279285.37,
                            "Others": 704313.8907064605,
                            "Biotechnology": 49.72,
                            "Aerospace/Defense": 380106.54,
                            "Semiconductors": 371.9,
                            "Auto Manufacturers": 18213.43337263364,
                            "Banks": 366666.31,
                            "Diversified Finan Serv": 45970.8,
                            "Software": 29607.2,
                            "Internet": 164576.99
                        },
                        "short": {
                            "Semiconductors": -87162,
                            "Auto Manufacturers": -11763,
                            "Insurance": -4682.111099481583,
                            "Internet": -189.53
                        }
                    }
                }
    """
    return ChannelFactory.create(channel).get_portfolio_allocation(accountId)


@tools.append
def get_account_ledger(channel: str = Field(description="The channel.", default="ibkr"),
                       accountId: str = Field(description="Account ID whose ledger data is requested.")):
    """
    Get the given account's ledger data detailing its balances by currency.
    Returns: Object describing the account's balances in its base currency, by asset class and account segments. Will be duplicated by another object in response bearing the currency's name.
        The meaning of each field is as follows:
        - acctcode: The Account ID of the requested account.
        - cashbalance: The given account's cash balance in this currency.
        - cashbalancefxsegment: The given account's cash balance in its dedicated forex segment in this currency, if applicable.
        - commoditymarketvalue: Market value of the given account's commodity positions in this currency.
        - corporatebondsmarketvalue: Market value of the given account's corporate bond positions in this currency.
        - currency: Three-letter name of the currency reflected by this object, or 'BASE' for the account's base currency.
        - dividends: The given account's receivable (not yet disbursed) dividend balance in this currency.
        - exchangerate: Exchange rate of this currency relative to the account's base currency.
        - funds: The value of the given account's mutual fund holdings in this currency.
        - futuremarketvalue: The market value of the given account's futures positions in this currency.
        - futureoptionmarketvalue:Market value of the given account's futures options positions in this currency.
        - futuresonlypnl: PnL of the given account's futures positions in this currency.
        - interest: he given account's receivable interest balance in this currency.
        - issueroptionsmarketvalue: Market value of the given account's issuer options positions in this currency.
        - key: Value: "LedgerList", Identifies the nature of data. Always takes values 'LedgerList'.
        - moneyfunds: The value of the given account's money market fund holdings in this currency.
        - netliquidationvalue: The given account's net liquidation value of positions in this currency.
        - realizedpnl: The given account's realized PnL for positions in this currency.
        - secondkey: Additional identifier of the currency reflected in this object. Always matches 'currency' field.
        - sessionid
        - settledcash: The given account's settled cash balance in this currency.
        - severity:
        - stockmarketvalue: Market value of the given account's stock positions in this currency.
        - stockoptionmarketvalue: Market value of the given account's stock options positions in this currency.
        - tbillsmarketvalue: Market value of the given account's treasury bill positions in this currency.
        - tbondsmarketvalue: Market value of the given account's treasury bond positions in this currency.
        - timestamp: Timestamp of retrievable of this account ledger data.
        - unrealizedpnl: The given account's unrealied PnL for positions in this currency.
        - warrantsmarketvalue:Market value of the given account's warrant positions in this currency.
    """
    return ChannelFactory.create(channel).get_account_ledger(accountId)


@tools.append
def get_account_attributes(channel: str = Field(description="The channel.", default="ibkr"),
                           accountId: str = Field(description="Account ID whose attributes are requested.")):
    """
    Get a single account's attributes and capabilities.
    Returns: Account attributes. The meaning of each field is as follows:
        - accountAlias: User-defined alias assigned to the account for easy identification.
        - accountStatus: Unix epoch timestamp of account opening.
        - accountTitle: A name assigned to the account, typically the account holder name or business entity.
        - accountVan: The account's virtual account number, or otherwise its IB accountId if no VAN is set.
        - acctCustType: Identifies the type of client with which the account is associated, such as an individual or LLC.
        - brokerageAccess: Indicates whether account can receive live orders (do not mix with paper trading).
        - businessType: Enum: "IB_SALES" "IB_PROSERVE", A descriptor of the nature of the account, reflecting the responsible group within IB.
        - clearingStatus: Enum: "O" "P" "N" "A" "R" "C", Status of the account with respect to clearing at IB. O is open, P pending, N new, A abandoned, C closed, R rejected.
        - covestor: Indicates a Covestor account.
        - currency: Value: "USD", Base currency of the account.
        - desc: Internal human-readable description of the account.
        - displayName: Displayed name of the account in UI. Will reflect either the accountId or accountAlias, if set.
        - faClient: Indicates that the account is managed by a financial advisor.
        - ibEntity: Enum: "IBLLC-US" "IB-CAN" "IB-UK" "IB-IE", IB business entity under which the account resides.
        - id: The account's IB accountId.
        - noClientTrading: Indicates that trading by the client is disabled in the account.
        - parent: Describes account relations in partitioned or multiplexed (segemented) account structures.
        - PrepaidCrypto-P: Indicates whether account has a prepaid crypto segment (Crypto Plus) with PAXOS.
        - PrepaidCrypto-Z: Indicates whether account has a prepaid crypto segment (Crypto Plus) with ZEROHASH.
        - trackVirtualFXPortfolio: Indicates that virtual forex positions are tracked in the account.
        - tradingType: Value: "STKNOPT", Internal identifier used by IB to reflect the trading permissions of the account.
        - type: Value: "DEMO", Indicates whether the account exists in production, paper, or demo environments.
    """
    return ChannelFactory.create(channel).get_account_attributes(accountId)


@tools.append
def get_all_position(channel: str = Field(description="The channel.", default="ibkr"),
                     accountId: str = Field(description="Account ID whose positions are requested."),
                     pageId: int = Field(description="Paginates positions response. Indexed from 0. Max 100 positions returned per page. Defaulted to 0.")):
    """
    Get all positions in an account.
    Returns:
        - acctId: IB accountId of an account with a position in the requested conid.
        - allExchanges: string, Comma separated all exchanges on which the instrument trades.
        - assetClass: string, Asset class of the requested instrument.
        - avgCost: number, The account's average cost for its position.
        - avgPrice: number, The account's average price for its position.
        - baseAvgCost: number, Average cost in the account's base currency.
        - baseAvgPrice: number, Average price in the account's base currency.
        - baseMktPrice: number, Market price of instrument in the account's base currency.
        - baseMktValue: number, Market value of the position in the account's base currency.
        - baseRealizedPnl: number, Realized PnL for the instrument in the account's base currency.
        - baseUnrealizedPnl: number, Unrealized PnL for the instrument in the account's base currency.
        - chineseName: string, Chinese name of the instrument.
        - conid: integer <int32>, IB contract ID for the instrument.
        - contractDesc: string, Human-readable description of the instrument.
        - countryCode:string, Country in which the instrument is issued.
        - currency: string, Currency in which the instrument trades.
        - displayRule: object, Object defining minimum increments used in displaying market data for the instrument.
        - exchs: object or null
        - exerciseStyle: string or null, Style of exercise for options.
        - expiry: string or null, Expiration of instrument, if applicable.
        - fullName: string, Full display name of the instrument.
        - group: string, Industry sub-categorization of the instrument.
        - hasOptions: boolean,Indicates whether instrument has options contracts available for trading at IB.
        - incrementRules: Array of objects, Array containing increment rules used when pricing orders for the instrument.
        - isEventContract: boolean, Indicates whether the instrument is an Event Contract.
        - isUS: boolean, Indicates whether the instrument is issued in the US.
        - lastTradingDay: string, Last day of trading in the instrument, if applicable. Formatted YYYYMMDD.
        - listingExchange: string, The exchange on which the instrument is listed, or the primary exchange recognized by IB for the instrument.
        - mktPrice: number, Current market price of the instrument, in the instrument's currency.
        - mktValue: number, Current market value of the account's position in the instrument, in the instrument's currency.
        - model: string, Name of the model portfolio in which the account is invested that contributes this position.
        - multiplier: number, Instrument's multiplier, if applicable.
        - name: string, Formal name of the entity or asset to which the instrument relates.
        - pageSize: integer <int32>, Maximum number of accounts that can be returned in a single request.
        - position: number, Size of position in units of instrument.
        - putOrCall: string, Enum: "P" "C", The right of an options contract, if applicable.
        - realizedPnl: number, Realized PnL for the instrument in the instrument's currency.
        - sector: string, Industry sector categorization of the instrument.
        - sectorGroup: string, Industry sub-categorization of the instrument.
        - strike: string, Strike price, if applicable. Returned as string.
        - ticker: string, Symbol associated with the instrument.
        - time: integer <int32>, Time taken to retrieve position data in milliseconds.
        - type: string, Description of instrument, used to differentiate classes, if applicable.
        - undConid: integer <int32>, Contract ID of underlying instrument, if applicable.
        - unrealizedPnl: number, Unrealized PnL for the instrument in the account.
    """
    return ChannelFactory.create(channel).get_all_position(account_id=accountId, page_id=pageId)

@tools.append
def get_account_summary(channel: str = Field(description="The channel.", default="ibkr"),
                        accountId: str = Field(description="Account ID whose summary is requested."),):
    """
    Get account summary for an account
    Returns:
        - accountcode: The Account ID of the requested account. (value)
        - accountready: Indicates whether the account is fully open and tradable. (value)
        - accounttype: Identifies the type of client with which the account is associated, such as an individual or LLC. (value)
        - accruedcash: Amount of cash accrued (not yet disbursed) for all segments in the account. (amount)
    """
    return ChannelFactory.create(channel).get_account_summary(accountId)

@tools.append
def get_instrument_position(channel: str = Field(description="The channel.", default="ibkr"),
                              accountId: str = Field(description="Account ID whose summary is requested."),
                              conid: int = Field(description="Conid of the instrument whose position in the account is requested.")):
    """
    Get position for a given instrument in a single account. WaitSecDef attribute is always defaulted to false. It is possible to get position without security definition.
    Returns:
        - acctId: string, IB accountId of an account with a position in the requested conid.
        - allExchanges: string, Comma separated all exchanges on which the instrument trades.
        - assetClass: string, Asset class of the requested instrument.
        - avgCost: number, The account's average cost for its position.
        - avgPrice: number, The account's average price for its position.
        - baseAvgCost: number, Average cost in the account's base currency.
        - baseAvgPrice: number, Average price in the account's base currency.
        - baseMktPrice: number, Market price of instrument in the account's base currency.
        - baseMktValue: number, Market value of the position in the account's base currency.
        - baseRealizedPnl: number, Realized PnL for the instrument in the account's base currency.
        - baseUnrealizedPnl: number, Unrealized PnL for the instrument in the account's base currency.
        - chineseName: string, Chinese name of the instrument.
        - conExchMap: object, Mapping of contract exchanges.
        - conid: integer <int32>, IB contract ID for the instrument.
        - contractDesc: string, Human-readable description of the instrument.
        - countryCode: string, Country in which the instrument is issued.
        - currency: string, Currency in which the instrument trades.
        - displayRule: object, Object defining minimum increments used in displaying market data for the instrument.
        - exerciseStyle: string or null, Style of exercise for options.
        - expiry: string or null, Expiration of instrument, if applicable.
        - fullName: string, Full display name of the instrument.
        - group: string, Industry sub-categorization of the instrument.
        - hasOptions: boolean, Indicates whether instrument has options contracts available for trading at IB.
        - incrementRules: Array of objects, Array containing increment rules used when pricing orders for the instrument.
        - isEventContract: boolean, Indicates whether the instrument is an Event Contract.
        - isUS: boolean, Indicates whether the instrument is issued in the US.
        - lastTradingDay: string, Last day of trading in the instrument, if applicable. Formatted YYYYMMDD.
        - listingExchange: string, The exchange on which the instrument is listed, or the primary exchange recognized by IB for the instrument.
        - mktPrice: number, Current market price of the instrument, in the instrument's currency.
        - mktValue: number, Current market value of the account's position in the instrument, in the instrument's currency.
        - model: string,Name of the model portfolio in which the account is invested that contributes this position.
        - multiplier: number, Instrument's multiplier, if applicable.
        - name: string, Formal name of the entity or asset to which the instrument relates.
        - pageSize: integer <int32>,  Maximum number of accounts that can be returned in a single request.
        - position: number,  Size of position in units of instrument.
        - putOrCall: string,  Enum: "P" "C",  The right of an options contract, if applicable.
        - realizedPnl: number,  Realized PnL for the instrument in the instrument's currency.
        - sector:string,  Industry sector categorization of the instrument.
        - sectorGroup:string,  Industry sub-categorization of the instrument.
        - strike:string,  Strike price, if applicable. Returned as string.
        - ticker: string, Symbol associated with the instrument.
        - time: integer <int32>, Time taken to retrieve position data in milliseconds.
        - type: string, Description of instrument, used to differentiate classes, if applicable.
        - undConid: integer <int32>, Contract ID of underlying instrument, if applicable.
        - unrealizedPnl: number, Unrealized PnL for the instrument in the account.
    """
    return ChannelFactory.create(channel).get_position_for_given_instrument(accountId, conid)

@tools.append
def get_account_performance(channel: str = Field(description="The channel.", default="ibkr"),
                            accountIdList: List[str] = Field(description="Account IDs whose performance is requested."),):
    """
    the performance (MTM) for the given accounts, if more than one account is passed, the result is consolidated.
    Returns: An array of objects detailing contract performance
        - currencyType: string, Confirms if the currency type. If trading exclusively in your base currency, “base” will be returned.
        ed accountId.
          - lastSuccessfulUpdate: string, Returns the datetime in EST of the last successful call to the /pa endpoint.
          - start: string, Returns the start date of the request range.
          - periods: Array of strings, Returns the valid period values returned by the /pa/allperiods endpoint.
          - end: string, Returns the end date of the request range.
          - baseCurrency: string, Clarifies the base currency of the primary accountId.
          - <property name>: Returns the performance data for the given period value.
            - nav: Array of numbers, Net asset value data for the account or consolidated accounts. NAV data is not applicable to benchmarks.
            - cps: Array of numbers, Returns the object containing the Cumulative performance data. Correlates to the same index position of data returned by the "nav" field.
            - freq: string, Returns the determining frequency of the data range.
            - dates: Array of strings, Returns the dates corresponding to the frequency of data.
            - startNav: object, Returns the starting data for the current NAV details.
              - date: string, Returns the starting date for the current period's NAV range.
              - val: integer <int32>, Returns the inital NAV value of {Period Range} from the current date.
    """
    return ChannelFactory.create(channel).get_account_performance(accountIdList)


@tools.append
def get_period_account_performance(channel: str = Field(description="The channel.", default="ibkr"),
                                 accountIdList: List[str] = Field(description="An array of strings containing each account identifier to retrieve performance details for."),
                                 period: str = Field(description="""
                                 Enum: "1D" "7D" "MTD" "1M" "3M" "6M" "12M" "YTD", Specify the period for which the account should be analyzed. Available period lengths: 
                                 1D - The last 24 hours. 7D - The last 7 full days. MTD - Performance since the 1st of the month. 1M - A full calendar month from the last full trade day.
                                 3M - 3 full calendar months from the last full trade day.
                                 6M - 6 full calendar months from the last full trade day.
                                 12M - 12 full calendar month from the last full trade day.
                                 YTD - Performance since January 1st.""", default="12M")):
    """
    Returns the performance (MTM) for the given accounts, if more than one account is passed, the result is consolidated.
    Parameters:
        - account_id_list: An array of strings- rc: integer <int32>, Returns the data identifier (Internal Use Only).
        - view: Array of strings, Returns the accountIds being viewed and returned.
        - nd: integer <int32>, Returns the total data points.
        - id: string, Returns the request identifier, getPerformanceAllPeriods.
        - included: Array of strings, Returns an array containing accounts reviewed.
        - pm: string, Portfolio Measure. Used to indicate TWR or MWR values returned.
        - <property name>: Contains the relevant performance data for the specifi containing each account identifier to retrieve performance details for.
        - period: Enum: "1D" "7D" "MTD" "1M" "3M" "6M" "12M" "YTD", Specify the period for which the account should be analyzed. Available period lengths:
                                                - 1D - The last 24 hours.
                                                - 7D - The last 7 full days.
                                                - MTD - Performance since the 1st of the month.
                                                - 1M - A full calendar month from the last full trade day.
                                                - 3M - 3 full calendar months from the last full trade day.
                                                - 6M - 6 full calendar months from the last full trade day.
                                                - 12M - 12 full calendar month from the last full trade day.
                                                - YTD - Performance since January 1st.
    Returns: An array of objects detailing account performance information.
        - currencyType: string, Confirms if the currency type. If trading exclusively in your base currency, “base” will be returned.
        - rc: integer <int32>, Returns the data identifier (Internal Use Only).
        - view: Array of strings, Returns the accountIds being viewed and returned.
        - nd: integer <int32>, Returns the total data points.
        - id: string, Returns the request identifier, getPerformanceAllPeriods.
        - included: Array of strings, Returns an array containing accounts reviewed.
        - pm: string, Portfolio Measure. Used to indicate TWR or MWR values returned.
        - nav: object,Net asset value data for the account or consolidated accounts. NAV data is not applicable to benchmarks.
          - data: Array of objects, Contains the affiliated ‘nav’ data.
            - idType: string, Returns how identifiers are determined.
            - navs: Array of arrays, Returns sequential data points corresponding to the net asset value between the "start" and "end" days.
            - start: string, Returns the first available date for data.
            - end: string, Returns the end of the available frequency.
            - id: string, Returns the account identifier.
            - startNAV: object, Returns the intiial NAV available.
            - baseCurrency: string, Returns the base currency used in the account.
          - freq: string, Displays the values corresponding to a given frequency.
          - dates: Array of arrays, Returns the array of dates formatted as strings corresponding to your frequency, the length should be same as the length of returns inside data.
        - cps: object, Returns the object containing the Cumulative performance data.
          - data: Array of objects, Returns the array of cps data available.
            - idType: string, Returns how identifiers are determined.
            - start: string, Returns the first available date for data.
            - end: string, Returns the end of the available frequency.
            - id: string, Returns the account identifier.
            - returns: Array of arrays, Returns all cps values in order between the start and end times.
            - baseCurrency: string, Returns the base currency used in the account.
          - freq: string, Returns the determining frequency of the data range.
          - dates: Array of arrays, Returns the dates corresponding to the frequency of data.
        - tpps: object, Returns the time period performance data.
          - data: Array of objects, Returns the array of tpp data available.
            - idType: string, Returns how identifiers are determined.
            - start: string, Returns the first available date for data.
            - end: string, Returns the end of the available frequency.
            - id: string, Returns the account identifier.
            - returns: Array of arrays, Returns all cps values in order between the start and end times.
            - baseCurrency: string, Returns the base currency used in the account.
          - freq: string, Returns the determining frequency of the data range.
          - dates: Array of arrays, returns the dates corresponding to the frequency of data.
    """
    return ChannelFactory.create(channel).get_account_performance_for_given_period(accountIdList, period)

@tools.append
def get_history_transactions(channel: str = Field(description="The channel.", default="ibkr"),
                             accountIdList: List[str] = Field(description="An array of strings, include each account ID as a string to receive data for."),
                             conidList: List[str] = Field(description="An array of strings, include contract ID to receive data for. Conids may be passed as integers or strings. Only supports one contract id at a time."),
                             currency: str = Field(description="Define the currency to display price amounts with. Such as USD、HKD", default="USD"),
                             days: int = Field(description="Specify the number of days to receive transaction data for.", default= 90)):
    """
    Returns the history transactions for the given accounts, if more than one account is passed, the result is consolidated.
    Returns: An array of objects detailing contract information
        - rc: Client portal use only
        - nd: integer <int32>, Client portal use only
        - rpnl: Returns the object containing the realized pnl for the contract on the date.
        - currency: Returns the currency the account is traded in.
        - from: Returns the epoch time for the start of requests.
        - id: Returns the request identifier, getTransactions.
        - to: Returns the epoch time for the end of requests.
        - includesRealTime: Returns if the trades are up to date or not.
        - transactions:Array of objects, Lists all supported transaction values.
            - date: Reutrns the human-readable datetime of the transaction.
            - cur: Returns the currency of the traded insturment.
            - fxRate: Returns the forex conversion rate.
            - pr: Returns the price per share of the transaction.
            - qty: integer <int32>,-Returns the total quantity traded. Will display a negative value for sell orders, and a positive value for buy orders.
            - acctid: string, Returns the account which made the transaction.
            - amt: integer <int32>, Returns the total value of the trade.
            - conid: integer <int32>, Returns the contract identifier.
            - type: string, Returns the order side.
            - desc: string, Returns the long name for the company.
    """
    if not currency:
        currency = "USD"
    return ChannelFactory.create(channel).get_history_transactions(accountIdList, conidList, currency, days)
