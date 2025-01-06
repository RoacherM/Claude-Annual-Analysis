'''
Author: ByronVon
Date: 2025-01-02 22:26:35
FilePath: /ClaudeAnnualAnalysis/cluster.py
Description: 
'''
import re
from collections import defaultdict
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_similarity

def fast_topic_clustering(texts, eps=0.3, min_samples=2):
    """
    快速主题聚类统计算法
    
    Args:
        texts: 文本列表
        eps: DBSCAN的邻域半径参数
        min_samples: DBSCAN的最小样本数参数
    
    Returns:
        topics: 主题词典，key为主题关键词，value为该主题下的文本数量
    """
    # 1. 文本预处理
    processed_texts = [re.sub(r'[^\w\s]', '', text.lower()) for text in texts]
    
    # 2. TF-IDF向量化
    vectorizer = TfidfVectorizer(
        max_features=1000,
        stop_words='english'
    )
    tfidf_matrix = vectorizer.fit_transform(processed_texts)
    
    # 3. 计算余弦相似度矩阵
    similarity_matrix = cosine_similarity(tfidf_matrix)
    
    # 4. 将相似度转换为距离，确保没有负值
    distance_matrix = np.clip(1 - similarity_matrix, 0, 2)  # 限制在[0,2]范围内
    
    # 5. 使用DBSCAN进行聚类
    clustering = DBSCAN(
        eps=eps,
        min_samples=min_samples,
        metric='precomputed'
    ).fit(distance_matrix)
    
    # 6. 统计主题
    labels = clustering.labels_
    print(f"Cluster labels: {labels}")  # Debug print
    topics = defaultdict(int)
    
    for i, label in enumerate(labels):
        if label != -1:  # 排除噪声点
            # 获取当前文本的关键词作为主题标识
            text_vector = tfidf_matrix[i].toarray()[0]
            top_words_idx = np.argsort(text_vector)[-3:][::-1]  # 取top3关键词，并反转顺序确保最重要的词在前
            print(f"Top word indices for text {i}: {top_words_idx}")  # Debug print
            
            # 获取词汇表
            vocab = vectorizer.get_feature_names_out()
            topic_words = [vocab[idx] for idx in top_words_idx]
            print(f"Topic words for text {i}: {topic_words}")  # Debug print
            
            topic_key = ' '.join(topic_words)
            topics[topic_key] += 1
    
    # 如果没有找到任何主题，至少返回一些信息
    if not topics:
        print("No clusters found with current parameters. Adjusting eps and min_samples might help.")
        return {"no_clusters": len(texts)}
        
    return dict(sorted(topics.items(), key=lambda x: x[1], reverse=True))

# 使用示例
if __name__ == "__main__":
    import json
    
    data = json.load(open('./data-2024-12-31-09-30-30/conversations.json', 'r', encoding='utf-8'))
    texts = [d['name'] for d in data]

    print("Input texts:")
    for i, text in enumerate(texts):
        print(f"{i}: {text}")
    print("\nClustering results:")
    
    # 尝试不同的参数
    topics = fast_topic_clustering(texts, eps=0.4, min_samples=2)
    print("\nResults:")
    for topic, count in topics.items():
        print(f"Topic: {topic}, Count: {count}")