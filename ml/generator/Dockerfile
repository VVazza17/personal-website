FROM public.ecr.aws/lambda/python:3.11

# Keep model cache inside the image layer
ENV HF_HOME=/var/task/hf \
    TRANSFORMERS_CACHE=/var/task/hf/transformers \
    SENTENCE_TRANSFORMERS_HOME=/var/task/hf/sentencetransformers \
    TORCH_HOME=/var/task/hf/torch \
    PIP_NO_CACHE_DIR=1

RUN pip install --upgrade pip

# CPU torch
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu

# 🔧 Key pins so we get wheels instead of building from source
RUN pip install --prefer-binary "numpy==1.26.4" "sentencepiece==0.1.99"

# Transformers + accelerate (these work with numpy 1.26 wheels)
RUN pip install "transformers==4.41.2" "accelerate==0.32.1"

# Warm the model into the image layer (small first)
RUN python - <<'PY'
from transformers import T5ForConditionalGeneration, T5TokenizerFast
tok = T5TokenizerFast.from_pretrained("google/flan-t5-small")
mdl = T5ForConditionalGeneration.from_pretrained("google/flan-t5-small")
print("warmed flan-t5-small")
PY

COPY app.py ${LAMBDA_TASK_ROOT}/
CMD ["app.handler"]
