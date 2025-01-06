from umap import UMAP
from numpy import random


def project(embeddings):
    mapper = UMAP(n_components=2, metric="cosine").fit(
        embeddings
    )
    return mapper.embedding_, mapper


if __name__ == "__main__":
    embeddings = random.rand(1000, 768)
    print(project(embeddings))
