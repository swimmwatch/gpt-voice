int main() {
  auto* value = new int{1};
  delete value;
  return *value;
}
