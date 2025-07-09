from pydantic import Field

from ebang_securities_mcp_server.channel.channel_factory import ChannelFactory

tools = []


@tools.append
def signatures_and_owners(channel: str = Field(description="The channel", default="ibkr"),
                          accountId: str = Field(description="The account identifier to receive information for")):
    """
    Receive a list of all applicant names on the account and for which account and entity is represented.

    Returns:
        Return account entity information such as:
        {
            "accountId": "U1234567",
            "users": [
                {
                    "roleId": "OWNER",
                    "hasRightCodeInd": true,
                    "entity": {
                        "entityType": "INDIVIDUAL",
                        "entityName": "John Smith",
                        "firstName": "John",
                        "lastName": "Smith"
                    }
                }
            ],
            "applicant": {
                "signatures": [
                    "John Smith"
                ]
            }
        }
    """
    return ChannelFactory.create(channel).signatures_and_owners(accountId)


@tools.append
def switch_account(channel: str = Field(description="The channel", default="ibkr"),
                   accountId: str = Field(
                       description="Identifier for the unique account to retrieve information from")):
    """
    Switch the active account for data requests.

    Description:
        Changes the currently active account for API data retrieval.
        Note: This feature is exclusively available for:
        - Financial advisors
        - Multi-account structures

    Returns:
        Returns confirmation of the account switch with the new active account ID:
        {
            "set": true,        # Boolean indicating if switch was successful
            "acctId": "U2234567" # The newly active account ID
        }

    Example Response:
        {
            "set": true,
            "acctId": "U2234567"
        }
    """
    return ChannelFactory.create(channel).switch_account(accountId)


@tools.append
def accounts(channel: str = Field(description="The channel", default="ibkr"), ):
    """
    Retrieves the list of tradable accounts and their configurations available to the user.

    Description:
        Returns all accessible trading accounts with their properties, aliases, and platform permissions.
        Note: This endpoint must be called before modifying orders or querying open orders.

    Response Format (JSON):
        {
            # List of accessible accounts
            "accounts": [
                "All",        # Special identifier representing all accounts
                "U1234567",   # Primary account ID
                "U2234567",   # Sub-account 1 ID
                "U3234567"    # Sub-account 2 ID
            ],

            # Account-specific properties
            "acctProps": {
                "All": {
                    "hasChildAccounts": false,  # Whether contains sub-accounts
                    "supportsCashQty": false,    # Supports cash quantity orders
                    "supportsFractions": false   # Supports fractional shares
                },
                "U1234567": { ... },  # Same structure as 'All' with different values
                ...
            },

            # Account display aliases
            "aliases": {
                "U1234567": "Primary Account",  # Display name
                ...
            },

            # Platform feature permissions
            "allowFeatures": {
                # UI features
                "showGFIS": true,             # Shows global market data
                "showEUCostReport": false,    # Shows EU cost reports

                # Trading permissions
                "allowEventContract": true,   # Allows event contract trading
                "allowFXConv": true,          # Allows FX conversion
                "allowedAssetTypes": "STK,OPT,FUT,..."  # Allowed asset classes
            },

            # Supported chart timeframes by asset class
            "chartPeriods": {
                "STK": ["*"],                 # All timeframes
                "OPT": ["2h","1d","1w","1m"], # Specific intervals
                ...
            },

            # Current session information
            "selectedAccount": "U1234567",    # Currently active account
            "serverInfo": {
                "serverName": "server",
                "serverVersion": "Build 99.99.9"
            },
            "isPaper": true                  # Paper trading account flag
        }
    """
    return ChannelFactory.create(channel).accounts()


@tools.append
def account_profit_and_loss(channel: str = Field(description="The channel", default="ibkr")):
    """
    Provides detailed information on account profits and losses

    Returns:
        Return detailed information on account profits and losses such as:
        {
            "upnl": {
                "U1234567.Core": {
                    "rowType": 1,  #Returns the positional value of the returned account. Always returns 1 for individual accounts
                    "dpl": -12510,
                    "nl": 1290000,
                    "upl": 256000,
                    "el": 824600,
                    "mv": 1700000
                }
            }
        }
    """
    return ChannelFactory.create(channel).account_profit_and_loss()


@tools.append
def general_account_summary(channel: str = Field(description="The channel", default="ibkr"),
                            accountId: str = Field(description="user account id")):
    """
    Provides a general overview of the account details such as balance values.

    Returns:
        Return a general overview of the account details such as:
        {
            "accountType": "",
            "status": "",
            "balance": 825903,
            "SMA": 368538,
            "buyingPower": 3307124,
            "availableFunds": 825903,
            "excessLiquidity": 826781,
            "netLiquidationValue": 1290490,
            "equityWithLoanValue": 1281714,
            "regTLoan": 0,
            "securitiesGVP": 1793178,
            "totalCashValue": -401846,
            "accruedInterest": 0,
            "regTMargin": 0,
            "initialMargin": 464586,
            "maintenanceMargin": 463709,
            "cashBalances": [
                {
                    "currency": "EUR",
                    "balance": 194,
                    "settledCash": 194
                },
                {
                    "currency": "HKD",
                    "balance": 0,
                    "settledCash": 0
                },
                {
                    "currency": "JPY",
                    "balance": 14781,
                    "settledCash": 14781
                },
                {
                    "currency": "USD",
                    "balance": -402158,
                    "settledCash": -402158
                },
                {
                    "currency": "Total (in USD)",
                    "balance": -401846,
                    "settledCash": -401846
                }
            ]
        }
    """
    return ChannelFactory.create(channel).general_account_summary(accountId)


@tools.append
def available_funds(channel: str = Field(description="The channel", default="ibkr"),
                    accountId: str = Field(description="user account id")):
    """
    Provides a summary specific for available funds giving more depth than the standard /summary endpoint.

    Returns:
        Return a summary specific for available funds giving more depth than the standard /summary endpoint such as:
        {
            "total": {
                "current_available": "825,208 USD",
                "current_excess": "826,089 USD",
                "Prdctd Pst-xpry Excss": "0 USD",
                "SMA": "368,538 USD",
                "Lk Ahd Avlbl Fnds": "821,067 USD",
                "Lk Ahd Excss Lqdty": "822,324 USD",
                "overnight_available": "821,067 USD",
                "overnight_excess": "822,324 USD",
                "buying_power": "3,304,346 USD",
                "leverage": "n/a",
                "Lk Ahd Nxt Chng": "@ 16:00:00",
                "day_trades_left": "Unlimited"
            },
            "Crypto at Paxos": {
                "current_available": "0 USD",
                "current_excess": "0 USD",
                "Prdctd Pst-xpry Excss": "0 USD",
                "Lk Ahd Avlbl Fnds": "0 USD",
                "Lk Ahd Excss Lqdty": "0 USD",
                "overnight_available": "0 USD",
                "overnight_excess": "0 USD"
            },
            "commodities": {
                "current_available": "22,483 USD",
                "current_excess": "23,361 USD",
                "Prdctd Pst-xpry Excss": "0 USD",
                "Lk Ahd Avlbl Fnds": "18,342 USD",
                "Lk Ahd Excss Lqdty": "19,597 USD",
                "overnight_available": "18,342 USD",
                "overnight_excess": "19,597 USD"
            },
            "securities": {
                "current_available": "802,725 USD",
                "current_excess": "802,727 USD",
                "Prdctd Pst-xpry Excss": "0 USD",
                "SMA": "368,538 USD",
                "Lk Ahd Avlbl Fnds": "802,725 USD",
                "Lk Ahd Excss Lqdty": "802,727 USD",
                "overnight_available": "802,725 USD",
                "overnight_excess": "802,727 USD",
                "leverage": "1.43"
            }
        }
    """
    return ChannelFactory.create(channel).available_funds(accountId)


@tools.append
def balances(channel: str = Field(description="The channel", default="ibkr"),
             accountId: str = Field(description="user account id")):
    """
    Fetch account balance overview

    Returns:
        Return account balance overview such as:
        {
            "total": {
                "net_liquidation": "1,288,301 USD",
                "Nt Lqdtn Uncrtnty": "0 USD",
                "equity_with_loan": "1,279,520 USD",
                "Prvs Dy Eqty Wth Ln Vl": "1,275,902 USD",
                "Rg T Eqty Wth Ln Vl": "1,256,229 USD",
                "sec_gross_pos_val": "1,791,096 USD",
                "cash": "-401,693 USD",
                "MTD Interest": "-549 USD",         # Month-to-date interest
                "Pndng Dbt Crd Chrgs": "0 USD"
            },
            "Crypto at Paxos": {
                "net_liquidation": "0 USD",
                "equity_with_loan": "0 USD",
                "cash": "0 USD",
                "MTD Interest": "0 USD",         # Month-to-date interest
                "Pndng Dbt Crd Chrgs": "0 USD"
            },
            "commodities": {
                "net_liquidation": "32,072 USD",
                "equity_with_loan": "23,291 USD",
                "cash": "32,072 USD",
                "MTD Interest": "0 USD",         # Month-to-date interest
                "Pndng Dbt Crd Chrgs": "0 USD"
            },
            "securities": {
                "net_liquidation": "1,256,229 USD",
                "equity_with_loan": "1,256,229 USD",
                "Prvs Dy Eqty Wth Ln Vl": "1,275,902 USD",
                "Rg T Eqty Wth Ln Vl": "1,256,229 USD",
                "sec_gross_pos_val": "1,791,096 USD",
                "cash": "-433,765 USD",
                "MTD Interest": "-549 USD",         # Month-to-date interest
                "Pndng Dbt Crd Chrgs": "0 USD"
            }
        }
    """
    return ChannelFactory.create(channel).balances(accountId)


@tools.append
def margins(channel: str = Field(description="The channel", default="ibkr"),
            accountId: str = Field(description="user account id")):
    """
    Fetch account margins overview

    Returns:
        Return account margins overview such as:
        {
            "total": {
                "RegT Margin": "896,255 USD",
                "current_initial": "468,562 USD",
                "Prdctd Pst-xpry Mrgn @ Opn": "0 USD",
                "current_maint": "467,308 USD",
                "projected_liquidity_inital_margin": "468,562 USD",
                "Prjctd Lk Ahd Mntnnc Mrgn": "467,308 USD",
                "projected_overnight_initial_margin": "468,562 USD",
                "Prjctd Ovrnght Mntnnc Mrgn": "467,308 USD"
            },
            "Crypto at Paxos": {
                "current_initial": "0 USD",
                "Prdctd Pst-xpry Mrgn @ Opn": "0 USD",
                "current_maint": "0 USD",
                "projected_liquidity_inital_margin": "0 USD",
                "Prjctd Lk Ahd Mntnnc Mrgn": "0 USD",
                "projected_overnight_initial_margin": "0 USD",
                "Prjctd Ovrnght Mntnnc Mrgn": "0 USD"
            },
            "commodities": {
                "current_initial": "13,794 USD",
                "Prdctd Pst-xpry Mrgn @ Opn": "0 USD",
                "current_maint": "12,540 USD",
                "projected_liquidity_inital_margin": "13,794 USD",
                "Prjctd Lk Ahd Mntnnc Mrgn": "12,540 USD",
                "projected_overnight_initial_margin": "13,794 USD",
                "Prjctd Ovrnght Mntnnc Mrgn": "12,540 USD"
            },
            "securities": {
                "RegT Margin": "896,255 USD",
                "current_initial": "454,768 USD",
                "Prdctd Pst-xpry Mrgn @ Opn": "0 USD",
                "current_maint": "454,768 USD",
                "projected_liquidity_inital_margin": "454,768 USD",
                "Prjctd Lk Ahd Mntnnc Mrgn": "454,768 USD",
                "projected_overnight_initial_margin": "454,768 USD",
                "Prjctd Ovrnght Mntnnc Mrgn": "454,768 USD"
            }
        }
    """
    return ChannelFactory.create(channel).margins(accountId)


@tools.append
def market_value(channel: str = Field(description="The channel", default="ibkr"),
                 accountId: str = Field(description="user account id")):
    """
    Fetch comprehensive market value breakdown by asset class and currency.

    Description:
        Retrieves the complete valuation snapshot of all account holdings,
        categorized by:
        - Asset type (stocks, bonds, derivatives, etc.)
        - Currency denomination
        - Realized/unrealized P&L

    Returns:
        Dictionary with currency codes as top-level keys. Each currency contains:
        {
            "<CURRENCY_CODE>": {  # e.g., "EUR", "USD"
                "total_cash": str,           # Total cash balance
                "settled_cash": str,         # Cleared/available cash
                "MTD Interest": str,         # Month-to-date interest
                "stock": str,                # Equity holdings value
                "options": str,              # Options contracts value
                "futures": str,              # Futures contracts value
                "future_options": str,       # Options on futures value
                "funds": str,                # ETF/mutual funds value
                "dividends_receivable": str, # Pending dividend payments
                "mutual_funds": str,         # Mutual fund holdings
                "money_market": str,         # Money market instruments
                "bonds": str,                # Bond holdings value
                "Govt Bonds": str,           # Government bonds
                "t_bills": str,              # Treasury bills
                "warrants": str,             # Warrant instruments
                "issuer_option": str,        # Issuer options
                "commodity": str,            # Physical commodities
                "Notional CFD": str,         # CFD notional value
                "cfd": str,                  # Contract-for-difference
                "Cryptocurrency": str,       # Digital assets
                "net_liquidation": str,      # Total account value
                "unrealized_pnl": str,       # Open position P&L
                "realized_pnl": str,         # Closed position P&L
                "Exchange Rate": str         # Conversion rate to USD (e.g., 1.092525 EUR/USD)
            },
            "Total (in USD)": {             # Aggregate USD-converted values
                # (Same field structure as above)
            }
        }

    Exchange Rate Clarification:
        All "Exchange Rate" values represent the conversion rate FROM that currency TO USD.
        Example: "EUR": {"Exchange Rate": "1.092525"} means 1 EUR = 1.092525 USD

    Example Response:
        {
            "EUR": {
                "total_cash": "194",
                ...
                "Exchange Rate": "1.092525"  # EUR→USD rate
            },
            "Total (in USD)": {
                "total_cash": "-401,646",
                ...
                "Exchange Rate": "1.00"      # Base USD rate
            }
        }
    """
    return ChannelFactory.create(channel).market_value(accountId)


if __name__ == '__main__':
    content = ChannelFactory.create("ibkr").signatures_and_owners("DUM292628")
    print(content)
