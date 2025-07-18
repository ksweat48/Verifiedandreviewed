<?php
/**
 * WordPress ACF Functions for Review Gallery Images
 * Add these functions to your WordPress theme's functions.php file
 */

// Register ACF fields for review gallery images
function register_review_gallery_fields() {
    if (function_exists('acf_add_local_field_group')) {
        acf_add_local_field_group(array(
            'key' => 'group_review_gallery',
            'title' => 'Review Gallery Images',
            'fields' => array(
                array(
                    'key' => 'field_gallery_image_1',
                    'label' => 'Gallery Image 1',
                    'name' => 'gallery_image_1',
                    'type' => 'image',
                    'instructions' => 'Upload the first gallery image for the review',
                    'required' => 0,
                    'return_format' => 'url',
                    'preview_size' => 'medium',
                    'library' => 'all',
                ),
                array(
                    'key' => 'field_gallery_image_2',
                    'label' => 'Gallery Image 2',
                    'name' => 'gallery_image_2',
                    'type' => 'image',
                    'instructions' => 'Upload the second gallery image for the review',
                    'required' => 0,
                    'return_format' => 'url',
                    'preview_size' => 'medium',
                    'library' => 'all',
                ),
                array(
                    'key' => 'field_gallery_image_3',
                    'label' => 'Gallery Image 3',
                    'name' => 'gallery_image_3',
                    'type' => 'image',
                    'instructions' => 'Upload the third gallery image for the review',
                    'required' => 0,
                    'return_format' => 'url',
                    'preview_size' => 'medium',
                    'library' => 'all',
                ),
                array(
                    'key' => 'field_gallery_image_4',
                    'label' => 'Gallery Image 4',
                    'name' => 'gallery_image_4',
                    'type' => 'image',
                    'instructions' => 'Upload the fourth gallery image for the review',
                    'required' => 0,
                    'return_format' => 'url',
                    'preview_size' => 'medium',
                    'library' => 'all',
                ),
                array(
                    'key' => 'field_gallery_image_5',
                    'label' => 'Gallery Image 5',
                    'name' => 'gallery_image_5',
                    'type' => 'image',
                    'instructions' => 'Upload the fifth gallery image for the review',
                    'required' => 0,
                    'return_format' => 'url',
                    'preview_size' => 'medium',
                    'library' => 'all',
                ),
            ),
            'location' => array(
                array(
                    array(
                        'param' => 'post_type',
                        'operator' => '==',
                        'value' => 'post',
                    ),
                ),
            ),
            'menu_order' => 0,
            'position' => 'normal',
            'style' => 'default',
            'label_placement' => 'top',
            'instruction_placement' => 'label',
            'hide_on_screen' => '',
            'active' => true,
            'description' => 'Gallery images that will appear inline in the review content',
        ));
    }
}
add_action('acf/init', 'register_review_gallery_fields');

// Helper function to get all gallery images for a post
function get_review_gallery_images($post_id = null) {
    if (!$post_id) {
        $post_id = get_the_ID();
    }
    
    $gallery_images = array();
    
    for ($i = 1; $i <= 5; $i++) {
        $image_url = get_field("gallery_image_$i", $post_id);
        if ($image_url) {
            $gallery_images[] = $image_url;
        }
    }
    
    return $gallery_images;
}

// Helper function to get gallery image count
function get_review_gallery_count($post_id = null) {
    return count(get_review_gallery_images($post_id));
}

// Helper function to check if post has gallery images
function has_review_gallery($post_id = null) {
    return get_review_gallery_count($post_id) > 0;
}

// Add gallery images to REST API response
function add_gallery_images_to_rest_api($response, $post, $request) {
    $post_id = $post->ID;
    
    // Add individual gallery image fields
    for ($i = 1; $i <= 5; $i++) {
        $image_url = get_field("gallery_image_$i", $post_id);
        $response->data["gallery_image_$i"] = $image_url ?: null;
    }
    
    // Add convenience array of all gallery images
    $response->data['gallery_images'] = get_review_gallery_images($post_id);
    $response->data['gallery_count'] = get_review_gallery_count($post_id);
    
    return $response;
}
add_filter('rest_prepare_post', 'add_gallery_images_to_rest_api', 10, 3);

// Handle gallery image uploads via REST API
function handle_gallery_image_upload($request) {
    $post_id = $request->get_param('post_id');
    $image_index = $request->get_param('image_index'); // 1-5
    
    if (!$post_id || !$image_index || $image_index < 1 || $image_index > 5) {
        return new WP_Error('invalid_params', 'Invalid post ID or image index', array('status' => 400));
    }
    
    // Check if user can edit this post
    if (!current_user_can('edit_post', $post_id)) {
        return new WP_Error('forbidden', 'You do not have permission to edit this post', array('status' => 403));
    }
    
    // Handle file upload
    $files = $request->get_file_params();
    if (empty($files['image'])) {
        return new WP_Error('no_file', 'No image file provided', array('status' => 400));
    }
    
    $file = $files['image'];
    
    // Upload the file
    $upload = wp_handle_upload($file, array('test_form' => false));
    
    if (isset($upload['error'])) {
        return new WP_Error('upload_error', $upload['error'], array('status' => 500));
    }
    
    // Create attachment
    $attachment = array(
        'post_mime_type' => $upload['type'],
        'post_title' => sanitize_file_name($upload['file']),
        'post_content' => '',
        'post_status' => 'inherit'
    );
    
    $attachment_id = wp_insert_attachment($attachment, $upload['file'], $post_id);
    
    if (is_wp_error($attachment_id)) {
        return $attachment_id;
    }
    
    // Generate attachment metadata
    require_once(ABSPATH . 'wp-admin/includes/image.php');
    $attachment_data = wp_generate_attachment_metadata($attachment_id, $upload['file']);
    wp_update_attachment_metadata($attachment_id, $attachment_data);
    
    // Update the ACF field
    $field_name = "gallery_image_$image_index";
    update_field($field_name, $upload['url'], $post_id);
    
    return array(
        'success' => true,
        'attachment_id' => $attachment_id,
        'url' => $upload['url'],
        'field_name' => $field_name
    );
}

// Register REST API endpoint for gallery image uploads
function register_gallery_upload_endpoint() {
    register_rest_route('wp/v2', '/posts/(?P<post_id>\d+)/gallery/(?P<image_index>[1-5])', array(
        'methods' => 'POST',
        'callback' => 'handle_gallery_image_upload',
        'permission_callback' => function($request) {
            return current_user_can('edit_posts');
        },
        'args' => array(
            'post_id' => array(
                'required' => true,
                'validate_callback' => function($param, $request, $key) {
                    return is_numeric($param);
                }
            ),
            'image_index' => array(
                'required' => true,
                'validate_callback' => function($param, $request, $key) {
                    return is_numeric($param) && $param >= 1 && $param <= 5;
                }
            ),
        ),
    ));
}
add_action('rest_api_init', 'register_gallery_upload_endpoint');

// Add gallery images to post meta for easier querying
function sync_gallery_images_to_meta($post_id) {
    $gallery_images = get_review_gallery_images($post_id);
    update_post_meta($post_id, '_gallery_images', $gallery_images);
    update_post_meta($post_id, '_gallery_count', count($gallery_images));
}

// Hook to sync gallery images when ACF fields are updated
function sync_gallery_on_acf_save($post_id) {
    // Only run for posts
    if (get_post_type($post_id) !== 'post') {
        return;
    }
    
    sync_gallery_images_to_meta($post_id);
}
add_action('acf/save_post', 'sync_gallery_on_acf_save', 20);

// Add gallery information to admin columns
function add_gallery_admin_column($columns) {
    $columns['gallery_count'] = 'Gallery Images';
    return $columns;
}
add_filter('manage_posts_columns', 'add_gallery_admin_column');

function display_gallery_admin_column($column, $post_id) {
    if ($column === 'gallery_count') {
        $count = get_review_gallery_count($post_id);
        if ($count > 0) {
            echo "<strong>$count</strong> images";
        } else {
            echo '—';
        }
    }
}
add_action('manage_posts_custom_column', 'display_gallery_admin_column', 10, 2);

// Make gallery count column sortable
function make_gallery_column_sortable($columns) {
    $columns['gallery_count'] = 'gallery_count';
    return $columns;
}
add_filter('manage_edit-post_sortable_columns', 'make_gallery_column_sortable');

// Handle sorting by gallery count
function sort_by_gallery_count($query) {
    if (!is_admin() || !$query->is_main_query()) {
        return;
    }
    
    if ($query->get('orderby') === 'gallery_count') {
        $query->set('meta_key', '_gallery_count');
        $query->set('orderby', 'meta_value_num');
    }
}
add_action('pre_get_posts', 'sort_by_gallery_count');

?>
```

**Usage Instructions for WordPress:**

1. **Add the PHP code** to your WordPress theme's `functions.php` file
2. **Install Advanced Custom Fields (ACF)** plugin if not already installed
3. **The fields will automatically appear** in the post editor for all posts
4. **Gallery images will be available** via REST API at `/wp-json/wp/v2/posts/{id}` with the `gallery_image_1` through `gallery_image_5` fields

**Frontend Features:**

- **Hover Expansion**: Images scale up smoothly when hovered
- **Click to Lightbox**: Full-screen viewing with navigation
- **Responsive Grid**: Adapts to different screen sizes
- **Image Numbering**: Small badges show image order
- **Keyboard Navigation**: Arrow keys and Escape in lightbox
- **Automatic Injection**: Gallery appears after the first paragraph of content

**ACF Integration:**

- **5 Individual Fields**: `gallery_image_1` through `gallery_image_5`
- **REST API Support**: All gallery images included in API responses
- **Upload Endpoint**: Direct upload via REST API for form submissions
- **Admin Columns**: Shows gallery count in WordPress admin
- **Helper Functions**: Easy access to gallery data in templates