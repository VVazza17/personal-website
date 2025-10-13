FROM public.ecr.aws/lambda/python:3.11

ENV HF_HOME=/tmp/hf \
    TRANSFORMERS_CACHE=/tmp/hf/transformers \
    TORCH_HOME=/tmp/hf/torch

RUN pip install --no-cache-dir --upgrade pip
# CPU PyTorch
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
# Transformers + tokenizers
RUN pip install --no-cache-dir "transformers==4.43.3" "tokenizers>=0.15" "numpy==1.26.4"

# (Optional) warm model to reduce cold start
RUN python -c "from transformers import T5ForConditionalGeneration, T5TokenizerFast; \
tok=T5TokenizerFast.from_pretrained('google/flan-t5-base'); \
_ = T5ForConditionalGeneration.from_pretrained('google/flan-t5-base'); print('warmed')"

COPY app.py ${LAMBDA_TASK_ROOT}/
CMD ["app.handler"]
