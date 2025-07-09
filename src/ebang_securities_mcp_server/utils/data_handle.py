from decimal import Decimal
from loguru import logger


def str_to_number(data: str):
    try:
        # 使用Decimal处理价格，避免浮点数精度问题
        decimal_data = Decimal(data)
        if decimal_data % 1 == 0:  # 检查是否为整数
            return int(decimal_data)
        else:
            return float(decimal_data)

    except (ValueError, Decimal.InvalidOperation) as e:
        raise Exception(f"数值转换失败: {str(e)}")
