def normalize(value):
    return str(value or "").lower().strip()


def check_state(user_state, scheme_state):
    if not scheme_state or normalize(scheme_state) == "all":
        return True
    return normalize(user_state) == normalize(scheme_state)


def check_age(user_age, min_age, max_age):
    if user_age is None:
        return True
    if min_age is not None and user_age < min_age:
        return False
    if max_age is not None and user_age > max_age:
        return False
    return True


def check_gender(user_gender, scheme_gender):
    if not scheme_gender or normalize(scheme_gender) == "any":
        return True
    return normalize(user_gender) == normalize(scheme_gender)


def check_income(user_income, limit):
    if user_income is None:
        return True
    if limit is None:
        return True
    return user_income <= limit


def check_residence(user_res, scheme_res):
    if not scheme_res or normalize(scheme_res) == "any":
        return True
    return normalize(user_res) == normalize(scheme_res)


def check_exclusions(user, exclusions):
    return []


def custom_checks(user, scheme_id, notes):
    return True


# ---------------------------
# Single scheme check
# ---------------------------
def check_scheme_eligibility(user, scheme):

    e = scheme.get("eligibility", {})
    passed = True

    if not check_state(user.get("state"), scheme.get("applicable_state")):
        return False

    if not check_age(user.get("age"), e.get("min_age"), e.get("max_age")):
        passed = False

    if not check_gender(user.get("gender"), e.get("gender")):
        passed = False

    if not check_income(user.get("annualIncome"), e.get("annual_income_limit")):
        passed = False

    if not check_residence(user.get("residence"), e.get("residence")):
        passed = False

    return passed


# ---------------------------
# Main eligibility loop
# ---------------------------
def check_eligibility(user, schemes_data):

    eligible = []

    for scheme in schemes_data["schemes"]:

        if check_scheme_eligibility(user, scheme):
            eligible.append(scheme)  # ✅ FULL SCHEME RETURN

    return {
        "eligible": eligible
    }