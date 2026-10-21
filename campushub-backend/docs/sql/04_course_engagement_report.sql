-- Purpose: Department head dashboard — per-course snapshot showing
--          lecturer assignment, enrolled students, and resource counts.

SELECT
    d.name                              AS department_name,
    c.code                              AS course_code,
    c.title                             AS course_title,
    c.credits,
    COALESCE(
        u_lec.first_name || ' ' || u_lec.last_name,
        'Unassigned'
    )                                   AS lecturer_name,
    COUNT(DISTINCT e.student_id)        AS enrolled_students,
    COUNT(DISTINCT r.id)                AS resource_count
FROM academics_course c
    INNER JOIN academics_department d       ON d.id = c.department_id
    LEFT  JOIN accounts_user           u_lec ON u_lec.id = c.lecturer_id
    LEFT  JOIN academics_enrollment e       ON e.course_id = c.id
    LEFT  JOIN resources_resource   r       ON r.course_id = c.id
GROUP BY
    d.name, c.id, c.code, c.title, c.credits,
    u_lec.first_name, u_lec.last_name
ORDER BY d.name, enrolled_students DESC;
