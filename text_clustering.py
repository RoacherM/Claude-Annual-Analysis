import json
import logging
import os
import random
import textwrap
from collections import Counter, defaultdict

import faiss
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import plotly.express as px
from openai import OpenAI
from sentence_transformers import SentenceTransformer
from sklearn.cluster import DBSCAN
from tqdm import tqdm
from umap import UMAP

logging.basicConfig(level=logging.INFO)


DEFAULT_INSTRUCTION = instruction = (
    """Use a phrase to describe the general topic in above texts. No more than 10 words."""
)

DEFAULT_TEMPLATE = "<s>[INST]{examples}\n\n{instruction}[/INST]"


class ClusterClassifier:
    def __init__(
        self,
        embed_model_name="all-MiniLM-L6-v2",
        embed_device="cpu",
        embed_batch_size=64,
        embed_max_seq_length=512,
        embed_agg_strategy=None,
        umap_components=2,
        umap_metric="cosine",
        dbscan_eps=0.08,
        dbscan_min_samples=50,
        dbscan_n_jobs=16,
        summary_create=True,
        summary_model="gpt-3.5-turbo",
        summary_model_base="https://api.openai.com/v1",
        summary_model_token=None,  # OpenAI API key
        topic_mode="multiple_topics",
        summary_n_examples=10,
        summary_chunk_size=420,
        summary_template=None,
        summary_instruction=None,
    ):
        self.embed_model_name = embed_model_name
        self.embed_device = embed_device
        self.embed_batch_size = embed_batch_size
        self.embed_max_seq_length = embed_max_seq_length
        self.embed_agg_strategy = embed_agg_strategy

        self.umap_components = umap_components
        self.umap_metric = umap_metric

        self.dbscan_eps = dbscan_eps
        self.dbscan_min_samples = dbscan_min_samples
        self.dbscan_n_jobs = dbscan_n_jobs

        self.summary_create = summary_create
        self.summary_model = summary_model
        self.summary_model_base = summary_model_base
        self.summary_model_token = summary_model_token
        self.topic_mode = topic_mode
        self.summary_n_examples = summary_n_examples
        self.summary_chunk_size = summary_chunk_size
        self.summary_model_token = summary_model_token

        if summary_template is None:
            self.summary_template = DEFAULT_TEMPLATE
        else:
            self.summary_template = summary_template

        if summary_instruction is None:
            self.summary_instruction = DEFAULT_INSTRUCTION
        else:
            self.summary_instruction = summary_instruction

        self.embeddings = None
        self.faiss_index = None
        self.cluster_labels = None
        self.texts = None
        self.projections = None
        self.umap_mapper = None
        self.id2label = None
        self.label2docs = None

        self.embed_model = SentenceTransformer(
            self.embed_model_name, device=self.embed_device
        )
        self.embed_model.max_seq_length = self.embed_max_seq_length

    def fit(self, texts, embeddings=None):
        self.texts = texts

        if embeddings is None:
            logging.info("embedding texts...")
            self.embeddings = self.embed(texts)
        else:
            logging.info("using precomputed embeddings...")
            self.embeddings = embeddings
        print(f"embeddings shape: {self.embeddings.shape}")
        logging.info("building faiss index...")
        self.faiss_index = self.build_faiss_index(self.embeddings)
        logging.info("projecting with umap...")
        self.projections, self.umap_mapper = self.project(self.embeddings)
        logging.info("dbscan clustering...")
        self.cluster_labels = self.cluster(self.projections)
        self.id2cluster = {
            index: label for index, label in enumerate(self.cluster_labels)
        }
        self.label2docs = defaultdict(list)
        for i, label in enumerate(self.cluster_labels):
            self.label2docs[label].append(i)

        self.cluster_centers = {}
        for label in self.label2docs.keys():
            x = np.mean([self.projections[doc, 0] for doc in self.label2docs[label]])
            y = np.mean([self.projections[doc, 1] for doc in self.label2docs[label]])
            self.cluster_centers[label] = (x, y)

        print(f"Number of clusters is {len(set(self.cluster_labels))}")

        cluster_sizes = Counter(self.cluster_labels)
        print("\nCluster sizes:")
        for label, size in sorted(cluster_sizes.items()):
            if label == -1:
                print(f"Noise points: {size}")
            else:
                print(f"Cluster {label}: {size} items")

        if self.summary_create:
            logging.info("summarizing cluster centers...")
            self.cluster_summaries = self.summarize(self.texts, self.cluster_labels)
        else:
            self.cluster_summaries = None

        return self.embeddings, self.cluster_labels, self.cluster_summaries

    def infer(self, texts, top_k=1):
        embeddings = self.embed(texts)

        dist, neighbours = self.faiss_index.search(embeddings, top_k)
        inferred_labels = []
        for i in tqdm(range(embeddings.shape[0])):
            labels = [self.cluster_labels[doc] for doc in neighbours[i]]
            inferred_labels.append(Counter(labels).most_common(1)[0][0])

        return inferred_labels, embeddings

    def embed(self, texts):
        embeddings = self.embed_model.encode(
            texts,
            batch_size=self.embed_batch_size,
            show_progress_bar=True,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

        return embeddings

    def project(self, embeddings):
        try:
            umap_mapper = UMAP(
                n_components=self.umap_components,
                metric=self.umap_metric,
                low_memory=True,
                n_neighbors=10,
                min_dist=0.1,
                random_state=42,
            )
            projections = umap_mapper.fit_transform(embeddings)
            return projections, umap_mapper
        except Exception as e:
            logging.error(f"UMAP projection failed: {str(e)}")
            raise

    def cluster(self, embeddings):
        print(
            f"Using DBSCAN (eps, nim_samples)=({self.dbscan_eps,}, {self.dbscan_min_samples})"
        )
        clustering = DBSCAN(
            eps=self.dbscan_eps,
            min_samples=self.dbscan_min_samples,
            n_jobs=self.dbscan_n_jobs,
        ).fit(embeddings)

        return clustering.labels_

    def build_faiss_index(self, embeddings):
        index = faiss.IndexFlatL2(embeddings.shape[1])
        index.add(embeddings)
        return index

    def summarize(self, texts, labels):
        unique_labels = len(set(labels)) - 1  # exclude the "-1" label
        client = OpenAI(
            api_key=self.summary_model_token, base_url=self.summary_model_base
        )
        cluster_summaries = {-1: "None"}

        for label in range(unique_labels):
            num = len(self.label2docs[label])
            ids = np.random.choice(
                self.label2docs[label], min(self.summary_n_examples, num), replace=False
            )
            examples = "\n\n".join(
                [
                    f"Example {i+1}:\n{texts[_id][:self.summary_chunk_size]}"
                    for i, _id in enumerate(ids)
                ]
            )

            messages = [
                {
                    "role": "system",
                    "content": "You are a helpful assistant that summarizes text clusters.",
                },
                {
                    "role": "user",
                    "content": f"{examples}\n\n{self.summary_instruction}",
                },
            ]

            try:
                response = client.chat.completions.create(
                    model=self.summary_model,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=128,
                )
                print(f"Example request:\n{examples}\n{self.summary_instruction}")
                cluster_summaries[label] = {
                    "cluster": response.choices[0].message.content,
                    "nums": num,
                }
            except Exception as e:
                logging.error(f"Error summarizing cluster {label}: {str(e)}")
                cluster_summaries[label] = {"cluster": f"Cluster {label}", "nums": num}

        print(f"Number of clusters is {len(cluster_summaries)}")
        return cluster_summaries

    def _postprocess_response(self, response):
        """No longer needed with OpenAI API"""
        return response

    def save(self, folder):
        if not os.path.exists(folder):
            os.makedirs(folder)

        with open(f"{folder}/embeddings.npy", "wb") as f:
            np.save(f, self.embeddings)

        faiss.write_index(self.faiss_index, f"{folder}/faiss.index")

        with open(f"{folder}/projections.npy", "wb") as f:
            np.save(f, self.projections)

        with open(f"{folder}/cluster_labels.npy", "wb") as f:
            np.save(f, self.cluster_labels)

        with open(f"{folder}/texts.json", "w") as f:
            json.dump(self.texts, f)

        if self.cluster_summaries is not None:
            with open(f"{folder}/cluster_summaries.json", "w") as f:
                json.dump(self.cluster_summaries, f)

    def load(self, folder):
        if not os.path.exists(folder):
            raise ValueError(f"The folder '{folder}' does not exsit.")

        with open(f"{folder}/embeddings.npy", "rb") as f:
            self.embeddings = np.load(f)

        self.faiss_index = faiss.read_index(f"{folder}/faiss.index")

        with open(f"{folder}/projections.npy", "rb") as f:
            self.projections = np.load(f)

        with open(f"{folder}/cluster_labels.npy", "rb") as f:
            self.cluster_labels = np.load(f)

        with open(f"{folder}/texts.json", "r") as f:
            self.texts = json.load(f)

        if os.path.exists(f"{folder}/cluster_summaries.json"):
            with open(f"{folder}/cluster_summaries.json", "r") as f:
                self.cluster_summaries = json.load(f)
                keys = list(self.cluster_summaries.keys())
                for key in keys:
                    self.cluster_summaries[int(key)] = self.cluster_summaries.pop(key)

        # those objects can be inferred and don't need to be saved/loaded
        self.id2cluster = {
            index: label for index, label in enumerate(self.cluster_labels)
        }
        self.label2docs = defaultdict(list)
        for i, label in enumerate(self.cluster_labels):
            self.label2docs[label].append(i)

        self.cluster_centers = {}
        for label in self.label2docs.keys():
            x = np.mean([self.projections[doc, 0] for doc in self.label2docs[label]])
            y = np.mean([self.projections[doc, 1] for doc in self.label2docs[label]])
            self.cluster_centers[label] = (x, y)

    def show(self, interactive=False):
        df = pd.DataFrame(
            data={
                "X": self.projections[:, 0],
                "Y": self.projections[:, 1],
                "labels": self.cluster_labels,
                "content_display": [
                    textwrap.fill(txt[:1024], 64) for txt in self.texts
                ],
            }
        )

        if interactive:
            self._show_plotly(df)
        else:
            self._show_mpl(df)

    def _show_mpl(self, df):
        fig, ax = plt.subplots(figsize=(12, 8), dpi=300)

        df["color"] = df["labels"].apply(lambda x: "C0" if x == -1 else f"C{(x%9)+1}")

        df.plot(
            kind="scatter",
            x="X",
            y="Y",
            color=df["color"],
            s=0.75,
            alpha=0.8,
            linewidth=0,
            ax=ax,
            colorbar=False,
        )

        # Only show summaries if they exist
        if self.cluster_summaries is not None:
            for label in self.cluster_summaries.keys():
                if label == -1:
                    continue
                summary = self.cluster_summaries[label]
                position = self.cluster_centers[label]
                t = ax.text(
                    position[0],
                    position[1],
                    summary,
                    horizontalalignment="center",
                    verticalalignment="center",
                    fontsize=4,
                )
                t.set_bbox(
                    dict(
                        facecolor="white",
                        alpha=0.9,
                        linewidth=0,
                        boxstyle="square,pad=0.1",
                    )
                )
        ax.set_axis_off()

    def _show_plotly(self, df):
        fig = px.scatter(
            df,
            x="X",
            y="Y",
            color="labels",
            hover_data={"content_display": True, "X": False, "Y": False},
            width=1600,
            height=800,
            color_continuous_scale="HSV",
        )

        fig.update_traces(hovertemplate="%{customdata[0]}<extra></extra>")

        fig.update_traces(
            marker=dict(size=1, opacity=0.8),  # color="white"
            selector=dict(mode="markers"),
        )

        fig.update_layout(
            template="plotly_dark",
        )

        # show cluster summaries
        for label in self.cluster_summaries.keys():
            if label == -1:
                continue
            summary = self.cluster_summaries[label]
            position = self.cluster_centers[label]

            fig.add_annotation(
                x=position[0],
                y=position[1],
                text=summary,
                showarrow=False,
                yshift=0,
            )

        fig.show()
