import sys
import json
import os
import numpy as np
from scipy.constants import R
from sympy import symbols, Eq, solve

def simulate_reaction(data):
    """
    Simulates a basic chemical reaction.
    Input format: { "type": "stoichiometry", "reactants": {"H2": 2, "O2": 1}, "products": {"H2O": 2}, "limit_reactant": "O2", "amount_mol": 1 }
    """
    try:
        rtype = data.get("type", "stoichiometry")
        
        if rtype == "stoichiometry":
            reactants = data["reactants"]
            products = data["products"]
            limit_reactant = data["limit_reactant"]
            amount = data["amount_mol"]
            
            # Find the multiplier based on the limiting reactant
            multiplier = amount / reactants[limit_reactant]
            
            result = {
                "consumed": {k: v * multiplier for k, v in reactants.items()},
                "produced": {k: v * multiplier for k, v in products.items()},
                "unit": "mol"
            }
            return {"success": True, "result": result}
            
        elif rtype == "equilibrium":
            # Simple equilibrium calculation: A <=> B
            # Kc = [B] / [A]
            # [A]0 = initial_a, [B]0 = initial_b
            # Kc = (initial_b + x) / (initial_a - x)
            initial_a = data["initial_a"]
            initial_b = data["initial_b"]
            kc = data["Kc"]
            
            x = symbols('x')
            equation = Eq(kc, (initial_b + x) / (initial_a - x))
            solution = solve(equation, x)
            
            final_x = float(solution[0])
            return {
                "success": True,
                "result": {
                    "final_a": initial_a - final_x,
                    "final_b": initial_b + final_x,
                    "delta": final_x,
                    "unit": "M"
                }
            }
            
        elif rtype == "gas_law":
            # PV = nRT
            p = data.get("P")
            v = data.get("V")
            n = data.get("n")
            t = data.get("T")
            
            if sum(x is None for x in [p, v, n, t]) > 1:
                return {"success": False, "error": "Need at least 3 variables for Ideal Gas Law"}
            
            if p is None: p = (n * R * t) / v
            elif v is None: v = (n * R * t) / p
            elif n is None: n = (p * v) / (R * t)
            elif t is None: t = (p * v) / (n * R)
            
            return {
                "success": True,
                "result": {"P": p, "V": v, "n": n, "T": t}
            }
            
        else:
            return {"success": False, "error": f"Unknown reaction type: {rtype}"}
            
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No input provided"}))
        sys.exit(1)
        
    try:
        raw_input = sys.argv[1]
        if raw_input.endswith('.json') and os.path.exists(raw_input):
            with open(raw_input, 'r') as f:
                input_data = json.load(f)
        else:
            input_data = json.loads(raw_input)
            
        output = simulate_reaction(input_data)
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Invalid input: {str(e)}"}))
