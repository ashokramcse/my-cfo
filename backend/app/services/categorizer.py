"""
Merchant categorization engine with keyword rules + regex patterns.
"""
import re
from typing import Optional

MERCHANT_RULES = [
    # Food & Dining
    (r"swiggy|zomato|uber\s*eats|food\s*panda|box8|faasos|freshmenu|dominos|pizza\s*hut|mcdonalds|kfc|subway|burger\s*king|starbucks|cafe\s*coffee|barbeque\s*nation|biryani", "FOOD"),
    (r"restaurant|dhaba|canteen|mess|tiffin|bakery|sweet\s*shop|juice|chai|tea\s*stall|hotel\s*\w+\s*food", "DINING"),
    (r"bigbasket|grofers|blinkit|zepto|dunzo|nature\s*basket|more\s*supermarket|dmart|reliance\s*fresh|spencers", "GROCERIES"),

    # Fuel
    (r"petrol|diesel|hp\s*(petrol|fuel)|iocl|bpcl|shell|essar|reliance\s*(petrol|fuel)|fuel\s*station|oil\s*station|cng", "FUEL"),

    # Shopping (amazon prime/prime video are subscriptions — must check before generic amazon)
    (r"amazon\s*prime|prime\s*video", "SUBSCRIPTION"),
    (r"amazon|flipkart|myntra|ajio|nykaa|purplle|meesho|snapdeal|shopclues|tatacliq|reliancedigital|croma|vijay\s*sales|reliance\s*digital", "SHOPPING"),
    (r"h&m|zara|uniqlo|westside|pantaloons|shoppers\s*stop|lifestyle|max\s*fashion|fbb|forever\s*21", "SHOPPING"),

    # Travel
    (r"makemytrip|goibibo|cleartrip|yatra|easemytrip|ixigo|booking\.com|airbnb|oyo|treebo|fabhotels", "TRAVEL"),
    (r"air\s*india|indigo|spicejet|vistara|go\s*first|airnz|emirates|lufthansa|singapore\s*airlines|british\s*airways", "TRAVEL"),
    (r"irctc|indian\s*railways|ola|uber|rapido|meru|quick\s*ride|metro|bus\s*pass|msrtc|bmtc|ksrtc", "TRAVEL"),

    # Utilities
    (r"bses|tata\s*power|adani\s*electricity|bescom|msedcl|bescom|jio|airtel|vodafone|bsnl|act\s*broadband|hathway", "UTILITIES"),
    (r"gas\s*(bill|booking)|mahanagar\s*gas|indraprastha\s*gas|igl|adani\s*gas|water\s*bill|bbmp|mcgm|nmc", "UTILITIES"),

    # Entertainment (ticketing / in-person)
    (r"bookmyshow|pvr|inox|cinepolis|amusement|gaming\s*zone|theme\s*park", "ENTERTAINMENT"),

    # Subscriptions (streaming & recurring digital)
    (r"netflix|hotstar|amazon\s*prime|zee5|sonyliv|voot|alt\s*balaji|mxplayer|jiocinema", "SUBSCRIPTION"),
    (r"spotify|gaana|jiosaavn|wynk|apple\s*music|youtube\s*premium|ps4|xbox|nintendo|steam", "SUBSCRIPTION"),

    # Healthcare
    (r"apollo|fortis|max\s*hospital|liferay|medanta|narayana|cipla|dr\s*reddys|sun\s*pharma|medplus|netmeds|1mg|pharmeasy|practo|lybrate", "HEALTHCARE"),
    (r"pharmacy|medical\s*store|clinic|diagnostic|lab\s*test|pathology|dentist|hospital\s*bill|insurance\s*premium", "HEALTHCARE"),

    # Subscriptions
    (r"microsoft|adobe|dropbox|google\s*(one|workspace|play)|apple\s*(one|icloud)|github|aws|digitalocean|gcp|heroku", "SUBSCRIPTION"),

    # Education
    (r"coursera|udemy|byju|unacademy|vedantu|toppr|khanacademy|linkedin\s*learning|pluralsight|skillshare", "EDUCATION"),
    (r"school\s*fee|college\s*fee|university\s*fee|exam\s*fee|tuition|coaching", "EDUCATION"),

    # Investment
    (r"zerodha|groww|upstox|angelbroking|icici\s*direct|hdfc\s*securities|sbisecurities|motilal|edelweiss|5paisa", "INVESTMENT"),
    (r"mutual\s*fund|sip\s*\w+|ppf|nps|lic\s*(premium|policy)|insurance\s*premium|term\s*plan", "INVESTMENT"),

    # Rent / Housing
    (r"rent|society\s*maintenance|apartment|flat\s*rent|house\s*rent|housing\s*society|no\s*broker|magic\s*bricks", "RENT"),

    # EMI
    (r"emi\s*\w+|equated\s*monthly|loan\s*emi|home\s*loan|car\s*loan|personal\s*loan", "EMI"),

    # Cash
    (r"atm\s*(withdrawal|cash|debit)|cash\s*advance|cash\s*at\s*atm", "CASH_WITHDRAWAL"),

    # Fees
    (r"annual\s*fee|late\s*payment|overdue\s*charge|processing\s*fee|joining\s*fee|renewal\s*fee|finance\s*charge", "FEES"),
]

# Pre-compile patterns
COMPILED_RULES = [(re.compile(pattern, re.IGNORECASE), category) for pattern, category in MERCHANT_RULES]


def categorize(description: str, merchant_name: Optional[str] = None) -> str:
    text = f"{description} {merchant_name or ''}".lower()

    for pattern, category in COMPILED_RULES:
        if pattern.search(text):
            return category

    return "OTHER"


def extract_merchant_name(description: str) -> str:
    """Clean up raw transaction description to extract merchant name."""
    # Remove common noise
    noise = [
        r"\d{2}/\d{2}/\d{4}", r"\d{4,16}",  # dates, card numbers
        r"POS\s*\d+", r"REF\s*\d+", r"AUTH\s*\d+",
        r"\bINR\b", r"\bUPI\b", r"\bNEFT\b", r"\bIMPS\b",
        r"ACH\s*\w+", r"\*\*\*\d+",
        r"BILLPAY", r"BILL\s*PAY",
    ]
    text = description
    for n in noise:
        text = re.sub(n, "", text, flags=re.IGNORECASE)

    # Capitalize first letters
    text = " ".join(w.capitalize() for w in text.split() if len(w) > 1)
    return text[:100].strip() or description[:50]
