import torch
import torch.nn as nn
import torchvision.models as models
from torchvision import transforms
from PIL import Image


class SoilFertilityResNet(nn.Module):
    def __init__(self, num_classes=3):
        super(SoilFertilityResNet, self).__init__()
        self.resnet = models.resnet18(pretrained=True)
        in_features = self.resnet.fc.in_features
        self.resnet.fc = nn.Linear(in_features, num_classes)

    def forward(self, x):
        return self.resnet(x)

num_classes = 3
model = SoilFertilityResNet(num_classes)

transform = transforms.Compose([
    transforms.Resize((224, 224)),  # Resize to ResNet input size
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# Example function to predict soil fertility from an image
def predict_soil_fertility(image_path, model, transform):
    model.eval()  # Set to evaluation mode
    image = Image.open(image_path).convert("RGB")  # Load image
    image = transform(image).unsqueeze(0)  # Apply transformations and add batch dimension
    with torch.no_grad():
        output = model(image)
        _, predicted = torch.max(output, 1)  # Get the class with highest probability
    return predicted.item()  # Return the predicted class index

# Load a sample image and predict (example)
# image_path = "path_to_soil_image.jpg"
# prediction = predict_soil_fertility(image_path, model, transform)
# print(f"Predicted Soil Fertility Level: {prediction}")
