# Token limits enforced per mode (passed as max_tokens_override to call_ai).
# Deep/Think modes include a <think>…</think> chain-of-thought block plus the
# final answer — both count against the same budget.  The limits below are
# sized to leave ample room for a detailed final answer after the reasoning
# block is stripped by extract_thinking_content().
_MODE_MAX_TOKENS = {
    'deep':     4000,   # ~1k for reasoning + 3k for detailed answer
    'thinking':  2000,  # ~500 for reasoning + 1500 for balanced answer
    None:         400,  # normal / no thinking — brief 1-2 paragraph response
}