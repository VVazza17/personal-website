FROM public.ecr.aws/lambda/python:3.11

ENV HF_HOME=/tmp/hf \
    TRANSFORMERS_CACHE=/tmp/hf/transformers \
    SENTENCE_TRANSFORMERS_HOME=/tmp/hf/sentencetransformers \
    TORCH_HOME=/tmp/hf/torch

RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir sentence-transformers==2.7.0 numpy==1.26.4

RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/e5-small-v2')"

COPY app.py ${LAMBDA_TASK_ROOT}/
CMD ["app.handler"]
