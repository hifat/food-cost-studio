- หน้า Recipe
    1. Form Create/Edit
        1.1 ให้เพิ่มตัวเลือกติ๊กถูกว่าจะบวก Base cost (ดึงข้อมูลจาก setting.other_percentage) มั้ย แล้วเก็บข้อมูลลงใน Recipe Entity ด้วย
        1.2 ตรงข้าง ๆ Live total อยากให้แสดงราคากรณีที่เราติ๊ก `+setting.other_percentage`
    2. Food Recipes Table
        2.1 Raw Material Cost ให้เปลี่ยนชื่อเป็น Material Cost
        2.2 ถ้ารายการข้อมูลอันไหนไม่ได้ติ๊ก `+setting.other_percentage` ก็ให้ Material Cost

- หน้า Menu
    - ตรง Table Food Recipes
        - Cost Per Unit แก้สูตรคำนวณ col `Raw Material Cost` / `Serving Size`