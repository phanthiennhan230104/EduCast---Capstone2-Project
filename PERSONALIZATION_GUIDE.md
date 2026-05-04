# 📋 Hướng Dẫn Cá Nhân Hóa Feed Theo Chủ Đề

## 1️⃣ Database Schema

### Hiện tại có:
- **tags** - Danh sách tags (#Python, #AI, #EdTech...)
- **post_tags** - Liên kết Post ↔ Tag

### Cần thêm:
- **post_topics** - Category/Topic của post (TECHNOLOGY, EDUCATION, LIFESTYLE...)
- **user_topic_preferences** - Chủ đề yêu thích của user (user_id, topic_id, score)

## 2️⃣ Logic Cá Nhân Hóa

```
Feed Bình Thường (Feed của Tôi)
  ↓
User chọn chủ đề yêu thích
  ↓ (lưu vào user_topic_preferences)
↓
Khi load feed:
  - Lấy chủ đề yêu thích của user
  - Lọc posts có post_topics.topic_id trùng
  - Sắp xếp theo score (posts liên quan nhiều hơn lên trên)
  ↓
Hiển thị feed chỉ có posts liên quan đến chủ đề yêu thích
```

## 3️⃣ Sidebar

Hiển thị trên sidebar:
- Top 5 chủ đề yêu thích của user
- Option: "Thêm chủ đề" (để chọn thêm)
- Option: "Tất cả" (xem feed bình thường)

## 4️⃣ Implementation Steps

### Backend:
1. ✅ Tạo PostTopic model (content/models.py)
2. ✅ Tạo UserTopicPreference model (users/models.py)
3. ✅ API endpoints:
   - GET /api/users/me/topic-preferences/
   - POST /api/users/me/topic-preferences/
   - GET /api/feed/?topic_id=XXX

### Frontend:
1. Sidebar: Hiển thị chủ đề yêu thích
2. Feed: Filter theo chủ đề
3. Modal: Thêm/bỏ chủ đề

