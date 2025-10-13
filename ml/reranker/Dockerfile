FROM public.ecr.aws/lambda/python:3.11

ENV HF_HOME=/tmp/hf \
    TRANSFORMERS_CACHE=/tmp/hf/transformers \
    SENTENCE_TRANSFORMERS_HOME=/tmp/hf/sentencetransformers \
    TORCH_HOME=/tmp/hf/torch

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Torch CPU wheels
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Pin numpy to manylinux wheel to avoid building from source
RUN pip install --no-cache-dir --prefer-binary "numpy==1.26.4"

# Sentence-Transformers (CrossEncoder lives here)
RUN pip install --no-cache-dir "sentence-transformers==2.7.0"

# (Optional) Warm the rerank model to reduce cold starts (no heredoc!)
RUN python -c "from sentence_transformers import CrossEncoder; CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2'); print('warmed')"

COPY app.py ${LAMBDA_TASK_ROOT}/
CMD ["app.handler"]
